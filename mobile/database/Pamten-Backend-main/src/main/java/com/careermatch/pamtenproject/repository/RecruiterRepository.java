package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Recruiter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RecruiterRepository extends JpaRepository<Recruiter, Integer> {
//    Optional<Recruiter> findByUserId(String userId);
    Optional<Recruiter> findByUser_UserId(String userId);
}