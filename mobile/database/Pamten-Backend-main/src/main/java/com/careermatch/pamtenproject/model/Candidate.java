package com.careermatch.pamtenproject.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "Candidates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "Can_id")
    private Integer candidateId;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "user_id")
    private User user;

    @Column(name = "FirstName", nullable = false)
    private String firstName;

    @Column(name = "DOB", nullable = false)
    private LocalDate dob;

    @Column(name = "Can_Gender")
    private String gender;

    @Column(name = "Experience")
    private Integer experience;

    @Column(name = "LinkedIn")
    private String linkedIn;

    @Column(name = "GitHub_username")
    private String githubUsername;
}