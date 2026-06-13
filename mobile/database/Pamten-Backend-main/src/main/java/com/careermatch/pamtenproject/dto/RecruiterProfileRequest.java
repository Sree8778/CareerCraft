package com.careermatch.pamtenproject.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class RecruiterProfileRequest {
    // User info (already available from registration)
    private String userId;

    // Employer details
    private String hrName;
    private String hrEmail;
    private String organizationName;
    private String endClient;
    private String vendorName;

    // Personal details
    private LocalDate dateOfBirth;
    private String gender;

    // Industry
    private String industryName;
}