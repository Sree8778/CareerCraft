package com.careermatch.pamtenproject.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class    JobResponse {
    private Integer jobId;
    private String employerNumber;
    private String organizationName;
    private String jobType;
    private String title;
    private String description;
    private String requiredSkills;
    private LocalDate postedDate;
    private String postedBy;
    private BigDecimal billRate;
    private Integer durationMonths;
    private Boolean isActive;
    private LocalDateTime createdAt;

    // Location details
    private String city;
    private String state;
    private String zipCode;
    private String country;

    // Industry details
    private List<String> industryNames;
}