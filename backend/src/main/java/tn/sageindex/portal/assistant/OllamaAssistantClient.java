package tn.sageindex.portal.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.*;

@Component
public class OllamaAssistantClient {
    private final ObjectMapper json;
    private final RestClient http;
    private final String model;
    private final boolean enabled;

    public OllamaAssistantClient(ObjectMapper json,
            @Value("${portal.assistant.ollama.url:http://host.docker.internal:11434}") String url,
            @Value("${portal.assistant.ollama.model:qwen3:8b}") String model,
            @Value("${portal.assistant.ollama.enabled:true}") boolean enabled) {
        this.json = json; this.model = model; this.enabled = enabled;
        this.http = RestClient.builder().baseUrl(url).build();
    }

    public Optional<Map<String,Object>> answer(AssistantRequest request, Map<String,Object> authorizedData) {
        if (!enabled) return Optional.empty();
        try {
            List<Map<String,String>> messages = new ArrayList<>();
            messages.add(Map.of("role","system","content",systemPrompt(request.currentView(), authorizedData)));
            if (request.history()!=null) request.history().stream().skip(Math.max(0,request.history().size()-10L))
                    .forEach(item->messages.add(Map.of("role",safeRole(item.role()),"content",item.content())));
            if (messages.size()==1 || !Objects.equals(messages.getLast().get("content"),request.message()))
                messages.add(Map.of("role","user","content",request.message()));
            Map<String,Object> body=Map.of("model",model,"messages",messages,"stream",false,"format","json",
                    "options",Map.of("temperature",.15,"num_predict",2200,"num_ctx",16384));
            JsonNode response=http.post().uri("/api/chat").contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
            String content=response==null?"":response.path("message").path("content").asText();
            Map<String,Object> result=json.readValue(cleanJson(content),new TypeReference<>(){});
            normalize(result,request.currentView()); return Optional.of(result);
        } catch(Exception ignored) { return Optional.empty(); }
    }

    private String systemPrompt(String view,Map<String,Object> data)throws Exception {
        return """
          Tu es SAGE Copilot, assistant industriel expert du portail SAGE HUB. Réponds en français aux questions libres sur Planning ECR, Sage RH, Traçabilité Store et leurs flux croisés.
          Utilise exclusivement les données autorisées ci-dessous pour les chiffres et statuts. N’invente jamais une valeur, une personne ou une opération. Si l’information manque, indique-le et oriente vers le bon dashboard.
          Connaissance: Planning gère dossiers, phases, actions, preuves, validations, PPAP/SOP, clôture et audit. RH gère employés, organisation, pointage, présence, demandes, avances, permutations, EDI et absentéisme. Traçabilité gère catalogue, réception, stock, coupe, STB, anomalies, corrections et journal. RH contrôle présence/ligne/projet avant consommation.
          Donne une réponse directe et utile. Pour une procédure, remplis workflow. Pour un diagnostic, remplis cards et insights. Tiens compte de l’historique. Ne prétends jamais avoir exécuté une action.
          Retourne uniquement un JSON strict:
          {"intent":"OVERVIEW|HR|PLANNING|TRACEABILITY|COMPARISON","confidence":0.0,"title":"...","answer":"...","cards":[{"label":"...","value":"...","tone":"HR|PLANNING|TRACEABILITY|DANGER|SUCCESS"}],"insights":["..."],"workflow":["..."],"sources":[{"label":"...","detail":"..."}],"action":{"label":"...","view":"ALL|HR|PLANNING|TRACEABILITY"},"suggestions":["...","...","..."]}
          Vue active: %s
          Données autorisées: %s
          """.formatted(view==null?"ALL":view,json.writeValueAsString(data));
    }
    private void normalize(Map<String,Object> r,String view){r.put("id",UUID.randomUUID().toString());r.put("createdAt",Instant.now().toString());r.put("answerType","LOCAL_AI");r.putIfAbsent("intent","OVERVIEW");r.putIfAbsent("confidence",.82);r.putIfAbsent("title","Réponse SAGE Copilot");r.putIfAbsent("answer","Information insuffisante.");r.putIfAbsent("cards",List.of());r.putIfAbsent("insights",List.of());r.putIfAbsent("workflow",List.of());r.putIfAbsent("sources",List.of());r.putIfAbsent("suggestions",List.of());r.putIfAbsent("action",Map.of("label","Voir le dashboard","view",view==null?"ALL":view));}
    private String cleanJson(String v){return v.trim().replaceFirst("(?s)^.*?\\{","{").replaceFirst("(?s)\\}[^}]*$","}");}
    private String safeRole(String v){return "assistant".equalsIgnoreCase(v)?"assistant":"user";}
}
