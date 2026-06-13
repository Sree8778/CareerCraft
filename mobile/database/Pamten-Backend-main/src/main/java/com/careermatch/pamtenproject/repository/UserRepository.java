package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByUserId(String userId);

    // For finding the highest userId
    Optional<User> findTopByOrderByUserIdDesc();

    // Add this method:
    Optional<User> findByUserId(String userId);
}