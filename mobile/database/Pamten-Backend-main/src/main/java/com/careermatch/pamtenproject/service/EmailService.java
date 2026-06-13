package com.careermatch.pamtenproject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendWelcomeEmail(String to, String fullName, String userId, String roleName) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Welcome to CareerMatch - Registration Successful!");
        
        String roleSpecificMessage = "";
        if ("Recruiter".equalsIgnoreCase(roleName)) {
            roleSpecificMessage = "\nAs a Recruiter, you'll need to complete your profile with employer details to start posting jobs.";
        } else if ("Candidate".equalsIgnoreCase(roleName)) {
            roleSpecificMessage = "\nAs a Candidate, you can start exploring job opportunities and applying to positions.";
        }
        
        message.setText(
                "Dear " + fullName + ",\n\n" +
                        "Welcome to CareerMatch! Your registration has been completed successfully.\n\n" +
                        "Your User ID: " + userId + "\n" +
                        "Your Role: " + roleName + "\n\n" +
                        roleSpecificMessage + "\n\n" +
                        "You can now log in to your account using your User ID and password.\n\n" +
                        "Best regards,\n" +
                        "The CareerMatch Team"
        );

        mailSender.send(message);
    }

    public void sendUserIdEmail(String to, String fullName, String userId) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Your CareerMatch User ID");
        message.setText(
                "Dear " + fullName + ",\n\n" +
                        "Thank you for registering with CareerMatch!\n\n" +
                        "Your User ID is: " + userId + "\n\n" +
                        "Please keep this User ID safe. You'll need it for future logins and account management.\n\n" +
                        "Best regards,\n" +
                        "The CareerMatch Team"
        );

        mailSender.send(message);
    }

    public void sendPasswordResetEmail(String to, String token) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Password Reset Request - CareerMatch");
        message.setText(
                "Dear user,\n\n" +
                        "We received a request to reset your password for your CareerMatch account.\n\n" +
                        "Use the following token to reset your password (valid for 30 minutes):\n\n" +
                        token + "\n\n" +
                        "If you did not request this, please ignore this email.\n\n" +
                        "Best regards,\n" +
                        "The CareerMatch Team"
        );
        mailSender.send(message);
    }
}