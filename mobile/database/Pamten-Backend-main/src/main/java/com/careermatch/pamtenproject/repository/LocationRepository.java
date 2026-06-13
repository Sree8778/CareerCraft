package com.careermatch.pamtenproject.repository;

import com.careermatch.pamtenproject.model.Location;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LocationRepository extends JpaRepository<Location, Integer> {
    List<Location> findByCity(String city);
    List<Location> findByState(String state);
    List<Location> findByCityAndState(String city, String state);
}