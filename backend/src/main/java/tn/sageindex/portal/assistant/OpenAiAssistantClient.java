package tn.sageindex.portal.assistant;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Component
public class OpenAiAssistantClient {
    private final ObjectMapper json;
    private final RestClient http;
    private final String apiKey;
    private final String model;

    public OpenAiAssistantClient(ObjectMapper json,
                                 @Value("${portal.assistant.openai.api-key:}") String apiKey,
                                 @Value("${portal.assistant.openai.model:gpt-5.6-sol}") String model) {
        this.json = json;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.http = RestClient.builder().baseUrl("https://api.openai.com/v1").build();
    }

    public boolean enabled() { return !apiKey.isBlank(); }

    public Optional<Map<String,Object>> answer(String username, AssistantRequest request, Map<String,Object> authorizedData) {
        if (!enabled()) return Optional.empty();
        try {
            List<Map<String,Object>> input = new ArrayList<>();
            if (request.history() != null) request.history().stream().skip(Math.max(0, request.history().size() - 10L))
                    .forEach(item -> input.add(Map.of("role", safeRole(item.role()), "content", item.content())));
            if (input.isEmpty() || !Objects.equals(input.getLast().get("content"), request.message()))
                input.add(Map.of("role", "user", "content", request.message()));

            Map<String,Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("instructions", systemPrompt(request.currentView(), authorizedData));
            body.put("input", input);
            body.put("reasoning", Map.of("effort", "medium"));
            body.put("text", Map.of("verbosity", "medium"));
            body.put("max_output_tokens", 2200);
            body.put("store", false);
            body.put("safety_identifier", safetyId(username));

            JsonNode response = http.post().uri("/responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(body).retrieve().body(JsonNode.class);
            String output = extractText(response);
            Map<String,Object> result = json.readValue(cleanJson(output), new TypeReference<>() {});
            normalize(result, request.currentView());
            return Optional.of(result);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private String systemPrompt(String view, Map<String,Object> data) throws Exception {
        return """
                Tu es SAGE Copilot, assistant industriel francophone du portail SAGE HUB.
                Réponds uniquement avec les données autorisées fournies et la connaissance métier ci-dessous. Ne fabrique jamais un chiffre, un statut ou une personne. Si une donnée manque, dis-le clairement et explique où la trouver.

                DOMAINES:
                - Planning ECR: dossiers modification/nouveau projet, phases, actions, responsables, criticité, délais, preuves, validation/rejet/réouverture, PPAP/SOP, clôture, annulation, pénalités, référentiels, audit.
                - Sage RH: employés, organisation, lignes, shifts, pointage, présence/absence, demandes, avances, permutations ENVOYER/RECEVOIR, opérateurs disponibles, EDI DELFOR, carrière IA, prévision absentéisme.
                - Traçabilité Store: catalogue, réception sérialisée, stock, consommation coupe, STB, anomalies, corrections compensatoires, journal, imports/exports et contrôle RH ligne-projet.
                - Flux transversal: SAGE HUB authentifie; RH fournit identité/présence/ligne; Traçabilité contrôle puis consomme; Planning pilote le changement industriel.

                RÈGLES:
                1. Comprends les questions libres, fautes, abréviations et relances contextuelles.
                2. Commence par une réponse directe, puis explique l’analyse et les prochaines actions.
                3. Pour une procédure, fournis workflow. Pour un état, fournis KPI et recommandations. Pour une comparaison, classe les risques.
                4. Ne prétends jamais avoir modifié une donnée. Tu peux conseiller et naviguer, mais pas valider, supprimer, clôturer ou consommer.
                5. action.view vaut ALL, HR, PLANNING ou TRACEABILITY.
                6. Réponds en JSON strict, sans markdown, avec exactement cette structure:
                {"intent":"...","confidence":0.0,"title":"...","answer":"...","cards":[{"label":"...","value":"...","tone":"HR|PLANNING|TRACEABILITY|DANGER|SUCCESS"}],"insights":["..."],"workflow":["..."],"sources":[{"label":"...","detail":"..."}],"action":{"label":"...","view":"ALL|HR|PLANNING|TRACEABILITY"},"suggestions":["...","...","..."]}

                Vue active: %s
                DONNÉES AUTORISÉES ACTUELLES:
                %s
                """.formatted(view == null ? "ALL" : view, json.writeValueAsString(data));
    }

    private void normalize(Map<String,Object> result, String currentView) {
        result.put("id", UUID.randomUUID().toString());
        result.put("createdAt", Instant.now().toString());
        result.put("answerType", "GENERATIVE");
        result.putIfAbsent("intent", "OVERVIEW"); result.putIfAbsent("confidence", .85);
        result.putIfAbsent("title", "Réponse SAGE Copilot"); result.putIfAbsent("answer", "Je ne dispose pas d’assez d’informations pour répondre précisément.");
        result.putIfAbsent("cards", List.of()); result.putIfAbsent("insights", List.of()); result.putIfAbsent("workflow", List.of()); result.putIfAbsent("sources", List.of()); result.putIfAbsent("suggestions", List.of());
        result.putIfAbsent("action", Map.of("label", "Voir le dashboard", "view", currentView == null ? "ALL" : currentView));
    }

    private String extractText(JsonNode response) {
        if (response == null) return "{}";
        StringBuilder out = new StringBuilder();
        for (JsonNode item : response.path("output")) for (JsonNode content : item.path("content"))
            if ("output_text".equals(content.path("type").asText())) out.append(content.path("text").asText());
        return out.toString();
    }
    private String cleanJson(String value) { return value.trim().replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", ""); }
    private String safeRole(String value) { return "assistant".equalsIgnoreCase(value) ? "assistant" : "user"; }
    private String safetyId(String username) throws Exception { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(username.getBytes(StandardCharsets.UTF_8))).substring(0,32); }
}
