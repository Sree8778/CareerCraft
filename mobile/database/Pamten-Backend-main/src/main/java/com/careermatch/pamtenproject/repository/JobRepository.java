package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Job;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepository extends JpaRepository<Job, Integer> {
    List<Job> findByEmployerEmployerId(Integer employerId);
    List<Job> findByIsActiveTrue();
    List<Job> findByLocationLocationId(Integer locationId);

    @Query("SELECT j FROM Job j WHERE j.isActive = true AND j.title LIKE %:keyword% OR j.description LIKE %:keyword%")
    List<Job> searchJobsByKeyword(String keyword);

    // Fix: Use custom query instead of method name
    @Query("SELECT j FROM Job j WHERE j.isActive = true ORDER BY j.postedDate DESC")
    Page<Job> findActiveJobsOrderByPostedDateDesc(Pageable pageable);
}