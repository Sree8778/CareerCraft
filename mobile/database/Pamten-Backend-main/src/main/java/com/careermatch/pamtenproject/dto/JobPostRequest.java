package com.careermatch.pamtenproject.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class JobPostRequest {
    private String userId; // Recruiter's user ID
    private String jobType;
    private String title;
    private String description;
    private String requiredSkills;
    private String postedBy;
    private BigDecimal billRate;
    private Integer durationMonths;

    // Location details
    private String city;
    private String state;
    private String zipCode;
    private String country;
    private String region;
    private String streetAddress;

    // Industry details
    private List<String> industryNames;
}