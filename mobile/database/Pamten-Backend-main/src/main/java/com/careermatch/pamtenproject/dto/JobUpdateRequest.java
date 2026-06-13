package com.careermatch.pamtenproject.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class JobUpdateRequest {
    private String jobType;
    private String title;
    private String description;
    private String requiredSkills;
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
