package com.careermatch.pamtenproject.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "Employers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "employer_id")
    private Integer employerId;

    @Column(name = "employer_number", nullable = false, unique = true)
    private String employerNumber;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "user_id")
    private User user;

    @Column(name = "hr_name", nullable = false)
    private String hrName;

    @Column(name = "hr_email", nullable = false)
    private String hrEmail;

    @ManyToOne
    @JoinColumn(name = "gender_id", referencedColumnName = "gender_id")
    private Gender gender;

    @Column(name = "organization_name", nullable = false)
    private String organizationName;

    @Column(name = "end_client")
    private String endClient;

    @Column(name = "vendor_name")
    private String vendorName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}