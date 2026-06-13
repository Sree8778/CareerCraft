package com.careermatch.pamtenproject.service;

import com.careermatch.pamtenproject.model.Recruiter;
import com.careermatch.pamtenproject.model.User;
import com.careermatch.pamtenproject.repository.RecruiterRepository;
import com.careermatch.pamtenproject.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RecruiterService {

    private final RecruiterRepository recruiterRepository;
    private final UserRepository userRepository;

    public Recruiter createOrUpdateRecruiterProfile(String userId, Recruiter recruiterData) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<Recruiter> existing = recruiterRepository.findByUser_UserId(userId);
        Recruiter recruiter;
        if (existing.isPresent()) {
            recruiter = existing.get();
            recruiter.setDateOfBirth(recruiterData.getDateOfBirth());
            recruiter.setGender(recruiterData.getGender());
            recruiter.setIndustry(recruiterData.getIndustry());

            // Update employer and its fields
            if (recruiterData.getEmployer() != null) {
                if (recruiter.getEmployer() == null) {
                    recruiter.setEmployer(recruiterData.getEmployer());
                } else {
                    recruiter.getEmployer().setOrganizationName(recruiterData.getEmployer().getOrganizationName());
                    recruiter.getEmployer().setHrName(recruiterData.getEmployer().getHrName());
                    recruiter.getEmployer().setHrEmail(recruiterData.getEmployer().getHrEmail());
                    recruiter.getEmployer().setEndClient(recruiterData.getEmployer().getEndClient());
                    recruiter.getEmployer().setVendorName(recruiterData.getEmployer().getVendorName());
                    recruiter.getEmployer().setGender(recruiterData.getEmployer().getGender());
                    // ...add any other employer fields you want to update
                }
            }
        } else {
            recruiter = Recruiter.builder()
                    .user(user)
                    .dateOfBirth(recruiterData.getDateOfBirth())
                    .gender(recruiterData.getGender())
                    .industry(recruiterData.getIndustry())
                    .employer(recruiterData.getEmployer())
                    .build();
        }
        return recruiterRepository.save(recruiter);
    }

    public Recruiter getRecruiterProfile(String userId) {
        return recruiterRepository.findByUser_UserId(userId)
                .orElseThrow(() -> new RuntimeException("Recruiter profile not found"));
    }
}