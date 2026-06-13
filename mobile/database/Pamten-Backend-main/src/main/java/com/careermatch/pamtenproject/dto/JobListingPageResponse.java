package com.careermatch.pamtenproject.dto;

import lombok.Data;
import lombok.Builder;
import java.util.List;

@Data
@Builder
public class JobListingPageResponse {
    private List<JobListingResponse> jobs;
    private int currentPage;
    private int totalPages;
    private long totalElements;
    private int pageSize;
    private boolean hasNext;
    private boolean hasPrevious;
}