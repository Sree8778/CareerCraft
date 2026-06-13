package com.careermatch.pamtenproject.controller;

import com.careermatch.pamtenproject.model.Gender;
import com.careermatch.pamtenproject.model.Industry;
import com.careermatch.pamtenproject.model.Role;
import com.careermatch.pamtenproject.repository.GenderRepository;
import com.careermatch.pamtenproject.repository.IndustryRepository;
import com.careermatch.pamtenproject.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/test/v1")
@RequiredArgsConstructor
public class TestController {

    private final RoleRepository roleRepository;
    private final GenderRepository genderRepository;
    private final IndustryRepository industryRepository;

    @GetMapping("/health")
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok("Database connection is working!");
    }

    @GetMapping("/roles")
    public ResponseEntity<List<Role>> getAllRoles() {
        List<Role> roles = roleRepository.findAll();
        return ResponseEntity.ok(roles);
    }

    @GetMapping("/genders")
    public ResponseEntity<List<Gender>> getAllGenders() {
        List<Gender> genders = genderRepository.findAll();
        return ResponseEntity.ok(genders);
    }

    @GetMapping("/industries")
    public ResponseEntity<List<Industry>> getAllIndustries() {
        List<Industry> industries = industryRepository.findAll();
        return ResponseEntity.ok(industries);
    }
} 