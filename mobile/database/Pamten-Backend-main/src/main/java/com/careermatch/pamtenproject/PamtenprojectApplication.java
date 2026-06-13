package com.careermatch.pamtenproject;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;

@SpringBootApplication
@EnableMethodSecurity
public class PamtenprojectApplication {
    public static void main(String[] args) {
        SpringApplication.run(PamtenprojectApplication.class, args);
    }
}