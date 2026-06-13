package com.careermatch.pamtenproject.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "Users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "user_id")
    private String userId;

    @ManyToOne
    @JoinColumn(name = "Role_id", referencedColumnName = "role_id")
    private Role role;

    @Column(name = "Email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String password;

    @Column(name = "Phone", nullable = false)
    private String phone;

    @Lob
    @Column(name = "QR_code")
    private byte[] qrCode;

    @Lob
    @Column(name = "Authenticator")
    private byte[] authenticator;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "profile_completed")
    private Boolean profileCompleted = false;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private LocalDateTime resetTokenExpiry;
}