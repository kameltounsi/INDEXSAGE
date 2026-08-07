package tn.sageindex.portal.assistant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record AssistantRequest(
        @NotBlank @Size(max = 1200) String message,
        @Size(max = 20) String currentView,
        List<HistoryMessage> history
) {
    public record HistoryMessage(@Size(max = 20) String role, @Size(max = 800) String content) {}
}
