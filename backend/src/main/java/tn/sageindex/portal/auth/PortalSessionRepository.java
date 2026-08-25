package tn.sageindex.portal.auth;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PortalSessionRepository extends JpaRepository<PortalSession, String> {
}
