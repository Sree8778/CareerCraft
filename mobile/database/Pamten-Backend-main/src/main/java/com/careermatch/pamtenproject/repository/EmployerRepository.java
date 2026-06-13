package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Employer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployerRepository extends JpaRepository<Employer, Integer> {
    Optional<Employer> findByUser_UserId(String userId);
    Optional<Employer> findByEmployerNumber(String employerNumber);
    @Query("SELECT MAX(CAST(e.employerNumber AS integer)) FROM Employer e")
    Integer findMaxEmployerNumber();

    boolean existsByEmployerNumber(String employerNumber);
}