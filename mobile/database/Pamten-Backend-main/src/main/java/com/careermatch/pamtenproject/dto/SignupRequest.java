package com.careermatch.pamtenproject.dto;

import lombok.Data;

@Data
public class SignupRequest {
    private String email;
    private String password;
    private String phone;
    private String roleName; // e.g., "Candidate" or "Recruiter"
    private String fullName;
}