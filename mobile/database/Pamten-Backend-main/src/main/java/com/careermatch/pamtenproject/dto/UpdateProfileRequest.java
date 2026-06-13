package com.careermatch.pamtenproject.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String userId;
    private String fullName;
    private String phone;
    // Add more fields if needed
}