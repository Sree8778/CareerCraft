package com.careermatch.pamtenproject.controller;

import com.careermatch.pamtenproject.dto.RecruiterProfileRequest;
import com.careermatch.pamtenproject.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile/v1")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @PostMapping("/recruiter/complete")
    public ResponseEntity<String> completeRecruiterProfile(@RequestBody RecruiterProfileRequest request) {
        try {
            String result = profileService.completeRecruiterProfile(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/status/{userId}")
    public ResponseEntity<Boolean> isProfileCompleted(@PathVariable String userId) {
        boolean isCompleted = profileService.isProfileCompleted(userId);
        return ResponseEntity.ok(isCompleted);
    }

    @GetMapping("/employer-number/{userId}")
    public ResponseEntity<String> getEmployerNumber(@PathVariable String userId) {
        String employerNumber = profileService.getEmployerNumber(userId);
        if (employerNumber != null) {
            return ResponseEntity.ok(employerNumber);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
} 