package com.careermatch.pamtenproject.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "Gender")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gender {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "gender_id")
    private Integer genderId;

    @Column(name = "gender_name", nullable = false, unique = true)
    private String genderName;
}