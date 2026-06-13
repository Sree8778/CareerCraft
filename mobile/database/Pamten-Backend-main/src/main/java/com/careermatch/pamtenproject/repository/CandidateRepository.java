package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Integer> {
    Optional<Candidate> findByUserUserId(String userId);
} 