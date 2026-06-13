package com.careermatch.pamtenproject.dto;

import lombok.Data;

@Data
public class LoginRequest {
    private String userId;
    private String password;
}