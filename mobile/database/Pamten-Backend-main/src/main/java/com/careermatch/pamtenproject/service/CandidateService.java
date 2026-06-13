//package com.careermatch.pamtenproject.service;
//
//import com.careermatch.pamtenproject.model.Candidate;
//import com.careermatch.pamtenproject.model.Job;
//import com.careermatch.pamtenproject.model.User;
//import com.careermatch.pamtenproject.repository.CandidateRepository;
//import com.careermatch.pamtenproject.repository.UserRepository;
//import lombok.RequiredArgsConstructor;
//import org.springframework.stereotype.Service;
//
//import java.util.Optional;
//
//@Service
//@RequiredArgsConstructor
//public class CandidateService {
//
//    private final CandidateRepository candidateRepository;
//    private final UserRepository userRepository;
//
//
//    public Candidate createOrUpdateCandidateProfile(String userId, Candidate candidateData) {
//        User user = userRepository.findById(userId)
//                .orElseThrow(() -> new RuntimeException("User not found"));
//
//        Optional<Candidate> existing = candidateRepository.findByUserUserId(userId);
//        Candidate candidate;
//        if (existing.isPresent()) {
//            candidate = existing.get();
//            // Update fields
//            candidate.setFirstName(candidateData.getFirstName());
//            candidate.setDob(candidateData.getDob());
//            candidate.setGender(candidateData.getGender());
//            candidate.setExperience(candidateData.getExperience());
//            candidate.setLinkedIn(candidateData.getLinkedIn());
//            candidate.setGithubUsername(candidateData.getGithubUsername());
//        } else {
//            candidate = Candidate.builder()
//                    .user(user)
//                    .firstName(candidateData.getFirstName())
//                    .dob(candidateData.getDob())
//                    .gender(candidateData.getGender())
//                    .experience(candidateData.getExperience())
//                    .linkedIn(candidateData.getLinkedIn())
//                    .githubUsername(candidateData.getGithubUsername())
//                    .build();
//        }
//        return candidateRepository.save(candidate);
//    }
//
//    public Candidate getCandidateProfile(String userId) {
//        return candidateRepository.findByUserUserId(userId)
//                .orElseThrow(() -> new RuntimeException("Candidate profile not found"));
//    }
//
//    public String applyForJob(String userId, Integer jobId) {
//        // Check if candidate profile exists
//        Candidate candidate = candidateRepository.findByUserUserId(userId)
//                .orElseThrow(() -> new RuntimeException("Candidate profile not found. Please complete your profile first."));
//
//
//
//        // TODO: Implement actual job application logic
//        // This would typically involve creating a JobApplication entity
//        // and storing the application details
//
//        return "Application submitted successfully for job: " + job.getTitle();
//    }
//}