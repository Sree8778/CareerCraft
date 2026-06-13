package com.careermatch.pamtenproject.service;

import com.careermatch.pamtenproject.dto.RecruiterProfileRequest;
import com.careermatch.pamtenproject.model.*;
import com.careermatch.pamtenproject.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final EmployerRepository employerRepository;
    private final RecruiterRepository recruiterRepository;
    private final GenderRepository genderRepository;
    private final IndustryRepository industryRepository;

    @Transactional
    public String completeRecruiterProfile(RecruiterProfileRequest request) {
        User user = userRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!"Recruiter".equalsIgnoreCase(user.getRole().getRoleName())) {
            throw new RuntimeException("User is not a recruiter");
        }
        if (user.getProfileCompleted()) {
            throw new RuntimeException("Profile already completed");
        }
        String employerNumber = generateUniqueEmployerNumber();
        Gender gender = genderRepository.findByGenderName(request.getGender())
                .orElseThrow(() -> new RuntimeException("Invalid gender"));
        Employer employer = Employer.builder()
                .employerNumber(employerNumber)
                .user(user)
                .hrName(request.getHrName())
                .hrEmail(request.getHrEmail())
                .gender(gender)
                .organizationName(request.getOrganizationName())
                .endClient(request.getEndClient())
                .vendorName(request.getVendorName())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        employerRepository.save(employer);
        Industry industry = null;
        if (request.getIndustryName() != null && !request.getIndustryName().trim().isEmpty()) {
            industry = industryRepository.findByIndustryName(request.getIndustryName()).orElse(null);
        }
        Recruiter recruiter = Recruiter.builder()
                .user(user)
                .employer(employer)
                .industry(industry)
                .dateOfBirth(request.getDateOfBirth())
                .gender(gender)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        recruiterRepository.save(recruiter);
        user.setProfileCompleted(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        return "Recruiter profile completed successfully! Employer Number: " + employerNumber;
    }

    public boolean isProfileCompleted(String userId) {
        // Example logic: fetch user and check profileCompleted flag
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getProfileCompleted();
    }

    public String getEmployerNumber(String userId) {
        Employer employer = employerRepository.findByUser_UserId(userId)
                .orElse(null);
        return (employer != null) ? employer.getEmployerNumber() : null;
    }

    private String generateUniqueEmployerNumber() {
        Integer maxNumber = employerRepository.findMaxEmployerNumber();
        int nextNumber = (maxNumber != null) ? maxNumber + 1 : 10000;
        if (nextNumber > 99999) {
            throw new RuntimeException("No available employer numbers");
        }
        return String.format("%05d", nextNumber);
    }
}