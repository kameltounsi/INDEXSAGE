package tn.sageindex.portal.assistant;

import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/assistant")
public class PortalAssistantController {
    private final PortalAssistantService service;
    public PortalAssistantController(PortalAssistantService service) { this.service = service; }

    @PostMapping("/chat")
    public Map<String,Object> chat(Authentication authentication, @Valid @RequestBody AssistantRequest request) {
        return service.answer(authentication.getName(), request);
    }
}
