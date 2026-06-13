package com.careermatch.pamtenproject.dto;

import lombok.Data;

@Data
public class UpdatePasswordRequest {
    private String userId;
    private String oldPassword;
    private String newPassword;
}
