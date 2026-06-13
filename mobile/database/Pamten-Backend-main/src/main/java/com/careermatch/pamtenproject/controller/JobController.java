package com.careermatch.pamtenproject.controller;

import com.careermatch.pamtenproject.dto.JobListingPageResponse;
import com.careermatch.pamtenproject.dto.JobListingResponse;
import com.careermatch.pamtenproject.dto.JobPostRequest;
import com.careermatch.pamtenproject.dto.JobUpdateRequest;
import com.careermatch.pamtenproject.dto.JobResponse;
import com.careermatch.pamtenproject.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/jobs/v1")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @PostMapping("/post")
    public ResponseEntity<?> postJob(@RequestBody JobPostRequest request) {
        System.out.println("JobController: postJob called for userId=" + request.getUserId());
        try {
            JobResponse response = jobService.postJob(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        try {
            JobListingPageResponse jobs = jobService.getAllJobs(page, size);
            return ResponseEntity.ok(jobs);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/employer/{userId}")
    public ResponseEntity<?> getJobsByEmployer(@PathVariable String userId) {
        try {
            List<JobResponse> jobs = jobService.getJobsByEmployer(userId);
            return ResponseEntity.ok(jobs);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PutMapping("/{jobId}")
    public ResponseEntity<?> updateJob(@PathVariable Integer jobId, @RequestBody JobUpdateRequest request) {
        try {
            JobResponse updated = jobService.updateJob(jobId, request);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
    
    @DeleteMapping("/{jobId}/{userId}")
    public ResponseEntity<?> deleteJob(@PathVariable Integer jobId, @PathVariable String userId) {
        try {
            jobService.deleteJob(jobId, userId);
            return ResponseEntity.ok("Job deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }
} 