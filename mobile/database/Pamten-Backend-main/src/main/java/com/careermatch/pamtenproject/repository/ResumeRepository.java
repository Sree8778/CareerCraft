package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Resume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResumeRepository extends JpaRepository<Resume, Integer> {
    // Find all resumes for a candidate
    List<Resume> findByCandidateCandidateId(Integer candidateId);

    // Find all active resumes for a candidate
    List<Resume> findByCandidateCandidateIdAndIsActiveTrue(Integer candidateId);

    // (Optional) Find the most recent resume for a candidate
    Optional<Resume> findTopByCandidateCandidateIdOrderByUploadDateDesc(Integer candidateId);
}