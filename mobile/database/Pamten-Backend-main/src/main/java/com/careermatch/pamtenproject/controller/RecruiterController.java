package com.careermatch.pamtenproject.controller;

import com.careermatch.pamtenproject.model.Recruiter;
import com.careermatch.pamtenproject.model.User;
import com.careermatch.pamtenproject.repository.UserRepository;
import com.careermatch.pamtenproject.service.RecruiterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recruiter/v1")
@RequiredArgsConstructor
public class RecruiterController {

    private final RecruiterService recruiterService;
    private final UserRepository userRepository;

    // Get the current recruiter's profile
    @GetMapping("/profile")
    @PreAuthorize("hasAuthority('Recruiter')")
    public ResponseEntity<Recruiter> getMyProfile(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Recruiter recruiter = recruiterService.getRecruiterProfile(user.getUserId());
        return ResponseEntity.ok(recruiter);
    }

    // Create or update the current recruiter's profile
    @PostMapping("/profile")
    @PreAuthorize("hasAuthority('Recruiter')")
    public ResponseEntity<Recruiter> createOrUpdateProfile(
            Authentication authentication,
            @RequestBody Recruiter recruiterData
    ) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Recruiter recruiter = recruiterService.createOrUpdateRecruiterProfile(user.getUserId(), recruiterData);
        return ResponseEntity.ok(recruiter);
    }
}