package com.careermatch.pamtenproject.dto;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String email;
    private String token;
    private String newPassword;
}