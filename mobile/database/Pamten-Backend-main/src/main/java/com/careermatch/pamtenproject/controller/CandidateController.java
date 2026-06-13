//package com.careermatch.pamtenproject.controller;
//
//import com.careermatch.pamtenproject.model.Candidate;
//import com.careermatch.pamtenproject.model.User;
//import com.careermatch.pamtenproject.repository.UserRepository;
//import com.careermatch.pamtenproject.service.CandidateService;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.security.core.Authentication;
//import org.springframework.web.bind.annotation.*;
//
//@RestController
//@RequestMapping("/api/candidate/v1")
//@RequiredArgsConstructor
//public class CandidateController {
//
//    private final CandidateService candidateService;
//    private final UserRepository userRepository;
//
//    // Get the current candidate's profile
//    @GetMapping("/profile")
//    @PreAuthorize("hasAuthority('Candidate')")
//    public ResponseEntity<Candidate> getMyProfile(Authentication authentication) {
//        String email = authentication.getName();
//        User user = userRepository.findByEmail(email)
//                .orElseThrow(() -> new RuntimeException("User not found"));
//        Candidate candidate = candidateService.getCandidateProfile(user.getUserId());
//        return ResponseEntity.ok(candidate);
//    }
//
//    // Create or update the current candidate's profile
//    @PostMapping("/profile")
//    @PreAuthorize("hasAuthority('Candidate')")
//    public ResponseEntity<Candidate> createOrUpdateProfile(
//            Authentication authentication,
//            @RequestBody Candidate candidateData
//    ) {
//        String email = authentication.getName();
//        User user = userRepository.findByEmail(email)
//                .orElseThrow(() -> new RuntimeException("User not found"));
//        Candidate candidate = candidateService.createOrUpdateCandidateProfile(user.getUserId(), candidateData);
//        return ResponseEntity.ok(candidate);
//    }
//
//    // Apply for a job
//    @PostMapping("/jobs/{jobId}/apply")
//    @PreAuthorize("hasAuthority('Candidate')")
//    public ResponseEntity<String> applyForJob(
//            @PathVariable Integer jobId,
//            Authentication authentication
//    ) {
//        String email = authentication.getName();
//        User user = userRepository.findByEmail(email)
//                .orElseThrow(() -> new RuntimeException("User not found"));
//
//        String result = candidateService.applyForJob(user.getUserId(), jobId);
//        return ResponseEntity.ok(result);
//    }
//
//    // Get candidate's job applications
//    @GetMapping("/applications")
//    @PreAuthorize("hasAuthority('Candidate')")
//    public ResponseEntity<String> getMyApplications(Authentication authentication) {
//        // To be implemented: fetch candidate's job applications
//        return ResponseEntity.ok("Applications endpoint to be implemented");
//    }
//}