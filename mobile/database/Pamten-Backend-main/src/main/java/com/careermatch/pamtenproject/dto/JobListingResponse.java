package com.careermatch.pamtenproject.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class JobListingResponse {
    private Integer jobId;
    private String title;
    private String city;
    private String state;
    private String organizationName;
    private LocalDate postedDate;
}
