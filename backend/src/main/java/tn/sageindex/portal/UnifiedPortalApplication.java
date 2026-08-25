package tn.sageindex.portal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class UnifiedPortalApplication {

	public static void main(String[] args) {
		SpringApplication.run(UnifiedPortalApplication.class, args);
	}

}
