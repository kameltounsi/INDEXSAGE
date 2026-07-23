package tn.sageindex.portal.account;

import java.util.List;

public record SeedAccount(
        Long employeeId,
        String matricule,
        String fullName,
        String department,
        String jobTitle,
        String workType,
        String supervisor,
        String email,
        String username,
        String employeeStatus,
        AccountStatus accountStatus,
        List<String> roles
) {}
