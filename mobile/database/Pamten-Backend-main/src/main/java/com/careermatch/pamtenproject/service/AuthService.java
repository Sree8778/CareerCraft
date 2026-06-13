package com.careermatch.pamtenproject.service;

import com.careermatch.pamtenproject.dto.*;
import com.careermatch.pamtenproject.model.Role;
import com.careermatch.pamtenproject.model.User;
import com.careermatch.pamtenproject.repository.RoleRepository;
import com.careermatch.pamtenproject.repository.UserRepository;
import com.careermatch.pamtenproject.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;

    // Custom userId generation logic based on name, handling all edge cases
    private String generateCustomUserId(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            fullName = "User X";
        }
        String[] parts = fullName.trim().split("\\s+");
        String firstName = parts.length > 1 ? String.join(" ", java.util.Arrays.copyOfRange(parts, 0, parts.length - 1)) : parts[0];
        String lastName = parts.length > 1 ? parts[parts.length - 1] : "user";

        // Use up to 5 letters of last name, lowercase
        String lastNamePart = lastName.length() >= 5 ? lastName.substring(0, 5).toLowerCase() : lastName.toLowerCase();
        // Use first letter of first name, lowercase
        String firstInitial = (firstName != null && !firstName.isEmpty()) ? firstName.substring(0, 1).toLowerCase() : "x";

        // Find the next available number for this pattern
        int number = 1;
        String userId;
        do {
            userId = lastNamePart + number + firstInitial;
            number++;
        } while (userRepository.existsByUserId(userId));
        return userId;
    }

    public RegistrationResponse registerUser(SignupRequest request) {
        // Check if user already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("User already exists with this email.");
        }

        // Validate role
        if (!"Candidate".equalsIgnoreCase(request.getRoleName()) &&
                !"Recruiter".equalsIgnoreCase(request.getRoleName())) {
            throw new RuntimeException("Invalid role. Must be 'Candidate' or 'Recruiter'.");
        }

        // Special validation for recruiters
        if ("Recruiter".equalsIgnoreCase(request.getRoleName())) {
            if (!request.getEmail().toLowerCase().endsWith("@pamten.com")) {
                throw new RuntimeException("Recruiter registration is restricted to @pamten.com email addresses.");
            }
        }

        // Find role
        Role role = roleRepository.findByRoleName(request.getRoleName())
                .orElseThrow(() -> new RuntimeException("Role not found: " + request.getRoleName()));

        // Generate unique user ID
        String userId = generateCustomUserId(request.getFullName());

        // Create user
        User user = User.builder()
                .userId(userId)
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .role(role)
                .fullName(request.getFullName())
                .profileCompleted(false) // Profile isn't completed yet
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        userRepository.save(user);

        // Send welcome email with userId
        try {
            emailService.sendWelcomeEmail(user.getEmail(), user.getFullName(), userId, role.getRoleName());
        } catch (Exception e) {
            // Log the error but don't fail registration
            System.err.println("Failed to send email: " + e.getMessage());
        }

        // Return response with user details
        return RegistrationResponse.builder()
                .userId(userId)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roleName(role.getRoleName())
                .profileCompleted(false)
                .message("Registration successful! Check your email for your User ID.")
                .build();
    }

    public LoginResponse loginUser(LoginRequest request) {
        User user = userRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Invalid userId or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid userId or password");
        }

        if (!user.getIsActive()) {
            throw new RuntimeException("Account is deactivated");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().getRoleName());
        return new LoginResponse(token, user.getRole().getRoleName(), user.getEmail(), user.getUserId(), user.getProfileCompleted());
    }

    public UserProfileResponse getUserProfile(String userId) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return UserProfileResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .roleName(user.getRole().getRoleName())
                .profileCompleted(user.getProfileCompleted())
                .isActive(user.getIsActive())
                .build();
    }

    public void updatePassword(UpdatePasswordRequest request) {
        User user = userRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new RuntimeException("Old password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    public void requestPasswordReset(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String token = UUID.randomUUID().toString();
        user.setResetToken(token);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(30)); // Token valid for 30 min
        userRepository.save(user);

        emailService.sendPasswordResetEmail(user.getEmail(), token);
    }

    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getResetToken() == null || !user.getResetToken().equals(request.getToken())) {
            throw new RuntimeException("Invalid or expired reset token");
        }
        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Reset token has expired");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
    }

    public void updateProfile(UpdateProfileRequest request) {
        User user = userRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (request.getFullName() != null && !request.getFullName().isEmpty()) {
            user.setFullName(request.getFullName());
        }
        if (request.getPhone() != null && !request.getPhone().isEmpty()) {
            user.setPhone(request.getPhone());
        }
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}