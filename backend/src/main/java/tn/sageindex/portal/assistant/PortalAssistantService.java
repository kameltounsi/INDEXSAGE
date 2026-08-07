package tn.sageindex.portal.assistant;

import org.springframework.stereotype.Service;
import tn.sageindex.portal.account.UserAccount;
import tn.sageindex.portal.account.UserAccountRepository;
import tn.sageindex.portal.dashboard.OperationalDataService;

import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class PortalAssistantService {
    private final OperationalDataService dataService;
    private final UserAccountRepository accounts;
    private final OpenAiAssistantClient openAi;
    private final OllamaAssistantClient ollama;

    public PortalAssistantService(OperationalDataService dataService, UserAccountRepository accounts, OpenAiAssistantClient openAi, OllamaAssistantClient ollama) {
        this.dataService = dataService;
        this.accounts = accounts;
        this.openAi = openAi;
        this.ollama = ollama;
    }

    public Map<String, Object> answer(String username, AssistantRequest request) {
        boolean admin = "admin".equals(username);
        Map<String, Object> data = admin ? dataService.load() : dataService.loadFor(account(username));
        Optional<Map<String,Object>> localAi = ollama.answer(request, data);
        if (localAi.isPresent()) return localAi.get();
        Optional<Map<String,Object>> generated = openAi.answer(username, request, data);
        if (generated.isPresent()) return generated.get();
        String normalized = normalize(request.message());
        if (normalized.length() < 28 && request.history() != null && request.history().size() > 1) {
            normalized = normalize(request.history().get(request.history().size() - 2).content()) + " " + normalized;
        }
        Map<String, Object> processAnswer = processAnswer(normalized);
        if (processAnswer != null) return processAnswer;
        Intent intent = detect(normalized, request.currentView(), request.history());
        return admin ? answerAdmin(intent, data) : answerUser(intent, data);
    }

    private Map<String, Object> processAnswer(String message) {
        if (containsAny(message, "flux transversal", "ligne projet", "entre rh", "modules dois", "quel module")) {
            return processResponse("OVERVIEW", .99, "Orchestration inter-applications",
                    "SAGE HUB gère l’identité et les accès. Sage RH fournit l’employé, sa présence, son shift et sa ligne. Traçabilité utilise ce contexte pour autoriser la consommation d’un composant compatible avec le projet. Planning ECR pilote en parallèle les modifications industrielles, actions, preuves et validations.",
                    List.of(kpi("Applications", 3, "SUCCESS"), kpi("Contrôle croisé", "RH → Stock", "TRACEABILITY"), kpi("Pilotage", "ECR", "PLANNING")),
                    List.of("Ouvrir RH pour corriger une présence ou une affectation", "Ouvrir Traçabilité pour une réception, consommation ou anomalie", "Ouvrir Planning pour une action, preuve ou validation ECR"),
                    List.of(source("SAGE HUB", "Identité et autorisations"), source("Sage RH", "Contexte opérationnel"), source("Traçabilité", "Stock et audit"), source("Planning ECR", "Workflow industriel")), "ALL",
                    List.of("Authentifier l’utilisateur dans SAGE HUB", "Charger son contexte opérationnel RH", "Contrôler ligne et projet avant consommation", "Tracer chaque mouvement de stock", "Piloter la modification via le workflow ECR"));
        }
        if (containsAny(message, "permutation", "operateur disponible", "avance salaire", "delfor", "edi", "cv", "carriere", "absenteisme")) {
            String subject = message.contains("permutation") ? "Permutations d’opérateurs" : message.contains("delfor") || message.contains("edi") ? "Traitement EDI DELFOR" : message.contains("avance") ? "Avances sur salaire" : message.contains("absenteisme") ? "Prévision de l’absentéisme" : "Services et intelligence RH";
            return processResponse("HR", .98, subject,
                    "Ce processus appartient à Sage RH. Il s’appuie sur l’organisation, les pointages et les droits du profil. Le portail peut en résumer la situation, détecter les blocages et vous diriger vers le module de traitement.",
                    List.of(kpi("Domaine", "RH", "HR"), kpi("Données", "Temps réel", "HR"), kpi("Contrôle", "Rôles", "SUCCESS")),
                    List.of("Vérifier les données d’entrée et l’éligibilité", "Traiter les demandes en attente", "Contrôler l’historique et les notifications"),
                    List.of(source("Sage RH", "Employés, organisation, pointages et workflows RH")), "HR",
                    message.contains("permutation") ? List.of("Sélectionner les opérateurs et le créneau", "Contrôler les chevauchements", "Soumettre au superviseur destinataire", "Accepter ou refuser", "Clôturer automatiquement à échéance")
                            : message.contains("edi") || message.contains("delfor") ? List.of("Importer ou coller le message DELFOR", "Parser et valider la structure", "Corriger les anomalies bloquantes", "Convertir en CSV", "Historiser et télécharger")
                            : List.of("Collecter les données RH autorisées", "Contrôler leur qualité", "Exécuter l’analyse", "Présenter le résultat et les facteurs", "Déclencher l’action RH adaptée"));
        }
        if (containsAny(message, "workflow", "dossier ecr", "phase", "preuve", "ppap", "sop", "validation action", "cloture", "annulation", "criticite", "penalite")) {
            return processResponse("PLANNING", .98, "Workflow dossier ECR",
                    "Le dossier progresse par phases contrôlées. Les responsables exécutent leurs actions, ajoutent les preuves puis demandent validation. Une phase peut être approuvée, rejetée ou rouverte avant passage à la suivante, jusqu’à clôture, archivage ou annulation.",
                    List.of(kpi("Flux", "ECR", "PLANNING"), kpi("Contrôle", "Validation", "PLANNING"), kpi("Preuves", "Requises", "SUCCESS")),
                    List.of("Contrôler les actions critiques et leurs échéances", "Vérifier que chaque preuve obligatoire est jointe", "Traiter les rejets avant la validation de phase"),
                    List.of(source("Gestion des plannings", "Dossiers, phases, actions, preuves et audit")), "PLANNING",
                    List.of("Créer le dossier et générer les actions standards", "Exécuter les actions et joindre les preuves", "Faire valider chaque action", "Demander la validation de phase", "Passer à la phase suivante ou corriger le rejet", "Clôturer puis archiver"));
        }
        if (containsAny(message, "stb", "coupe", "numero serie", "reception logistique", "correction consommation", "catalogue technique", "stock delete")) {
            return processResponse("TRACEABILITY", .98, "Processus de traçabilité industrielle",
                    "Le flux part du catalogue technique et de la réception sérialisée. Avant consommation en coupe, le système vérifie dans RH l’activité, la présence, la ligne et la compatibilité projet. Chaque mouvement écrit un événement d’audit et les corrections restent compensatoires.",
                    List.of(kpi("Flux", "Lot → Stock", "TRACEABILITY"), kpi("Contrôle", "RH + projet", "TRACEABILITY"), kpi("Audit", "Immuable", "SUCCESS")),
                    List.of("Vérifier le lot, la série et la quantité restante", "Contrôler la présence et la correspondance ligne-projet", "Utiliser une correction plutôt que supprimer l’historique"),
                    List.of(source("Traçabilité Store", "Réceptions, stock, consommations et événements"), source("Sage RH", "Présence et affectation opérationnelle")), "TRACEABILITY",
                    List.of("Identifier la pièce, le lot et le numéro de série", "Vérifier présence, ligne et projet dans RH", "Contrôler la quantité disponible", "Décrémenter le stock dans une transaction", "Générer le STB si nécessaire", "Écrire l’événement d’audit"));
        }
        return null;
    }

    private boolean containsAny(String message, String... terms) {
        for (String term : terms) if (message.contains(term)) return true;
        return false;
    }

    private Map<String,Object> processResponse(String intent,double confidence,String title,String answer,List<Map<String,Object>> cards,List<String> insights,List<Map<String,Object>> sources,String action,List<String> workflow) {
        Map<String,Object> out = response(intent, confidence, title, answer, cards, insights, sources, action);
        out.put("workflow", workflow);
        out.put("answerType", "PROCESS");
        return out;
    }

    private Map<String, Object> answerUser(Intent intent, Map<String, Object> root) {
        Map<String, Object> metrics = map(root.get("metrics"));
        Map<String, Object> trace = map(root.get("traceability"));
        Map<String, Object> hr = map(root.get("hr"));
        Map<String, Object> planning = map(root.get("planning"));
        Map<String, Object> user = map(root.get("user"));
        long traceRisk = number(trace.get("pendingControls"));
        long hrRisk = number(hr.get("pendingRequests")) + number(hr.get("teamAbsences"));
        long planningRisk = number(planning.get("lateActions"));
        String firstName = text(user.get("name")).split(" ")[0];

        return switch (intent) {
            case HR -> response("RH", 0.96,
                    "Votre situation RH", String.format(Locale.FRANCE,
                            "%s, votre statut aujourd’hui est « %s ». Votre taux de présence sur la période est de %s %% et vous avez %d demande(s) en attente%s.",
                            firstName, text(hr.get("presenceStatus")), decimal(metrics.get("attendanceRate")), number(hr.get("pendingRequests")),
                            number(hr.get("teamAbsences")) > 0 ? ", avec " + number(hr.get("teamAbsences")) + " absence(s) dans votre équipe" : ""),
                    List.of(kpi("Présence", text(hr.get("presenceStatus")), "RH"), kpi("Taux", decimal(metrics.get("attendanceRate")) + " %", "RH"), kpi("Demandes", number(hr.get("pendingRequests")), "RH")),
                    hrRisk > 0 ? List.of("Traiter les demandes en attente", "Contrôler les absences avant l’affectation des équipes") : List.of("Aucune urgence RH détectée"),
                    List.of(source("Ressources humaines", "Pointages et demandes actualisés")), "HR");
            case PLANNING -> response("PLANNING", 0.97,
                    "État du planning ECR", String.format(Locale.FRANCE,
                            "Vous avez %d action(s) ouverte(s), dont %d en retard. %d action(s) sont finalisées et l’avancement global atteint %s %%.",
                            number(planning.get("openActions")), planningRisk, number(planning.get("completedActions")), decimal(planning.get("completionRate"))),
                    List.of(kpi("Ouvertes", number(planning.get("openActions")), "PLANNING"), kpi("En retard", planningRisk, planningRisk > 0 ? "DANGER" : "PLANNING"), kpi("Avancement", decimal(planning.get("completionRate")) + " %", "PLANNING")),
                    planningRisk > 0 ? List.of("Commencer par les actions déjà en retard", "Vérifier les échéances les plus proches") : List.of("Aucun retard détecté dans vos actions"),
                    List.of(source("Gestion des plannings", "Actions, statuts et échéances ECR")), "PLANNING");
            case TRACEABILITY -> response("TRACEABILITY", 0.96,
                    "État de la traçabilité", String.format(Locale.FRANCE,
                            "%d lot(s) ont été traités aujourd’hui. %d anomalie(s) ou contrôle(s) restent ouverts. Votre dernière activité connue date de %s.",
                            number(trace.get("lotsToday")), traceRisk, blank(text(trace.get("lastUpdate"))) ? "—" : text(trace.get("lastUpdate"))),
                    List.of(kpi("Lots aujourd’hui", number(trace.get("lotsToday")), "TRACEABILITY"), kpi("À contrôler", traceRisk, traceRisk > 0 ? "DANGER" : "TRACEABILITY"), kpi("Actions terminées", number(metrics.get("completedActions")), "TRACEABILITY")),
                    traceRisk > 0 ? List.of("Vérifier les signalements ouverts avant expédition", "Contrôler les lots concernés") : List.of("Aucun signalement ouvert pour votre compte"),
                    List.of(source("Traçabilité", "Lots, événements et signalements")), "TRACEABILITY");
            case COMPARISON -> comparison(traceRisk, hrRisk, planningRisk);
            case HELP -> response("HELP", 0.99, "Ce que je peux analyser",
                    "Je peux expliquer votre présence, résumer vos demandes RH, analyser vos actions ECR, signaler les retards, examiner les lots et comparer les risques entre les trois applications.",
                    List.of(), List.of("Essayez : « Quelle est ma priorité aujourd’hui ? »", "Ou : « Compare les risques des trois applications »"),
                    List.of(source("Portail SAGE HUB", "Données autorisées pour votre compte")), "ALL");
            default -> overview(firstName, traceRisk, hrRisk, planningRisk, metrics, trace, hr, planning);
        };
    }

    private Map<String, Object> answerAdmin(Intent intent, Map<String, Object> root) {
        Map<String, Object> trace = map(root.get("traceability"));
        Map<String, Object> hr = map(root.get("hr"));
        Map<String, Object> planning = map(root.get("planning"));
        Map<String, Object> tt = map(trace.get("totals"));
        Map<String, Object> ht = map(hr.get("totals"));
        Map<String, Object> pt = map(planning.get("totals"));
        long traceRisk = number(tt.get("openissues"));
        long planningRisk = number(pt.get("lateactions"));
        if (intent == Intent.HR) return response("HR", .96, "Vue RH globale",
                String.format("La base compte %d collaborateur(s), %d pointage(s) et %s heure(s) supplémentaire(s) ce mois.", number(ht.get("employees")), number(ht.get("attendancerecords")), decimal(ht.get("monthlyovertime"))),
                List.of(kpi("Collaborateurs", number(ht.get("employees")), "RH"), kpi("Pointages", number(ht.get("attendancerecords")), "RH"), kpi("Départements", number(ht.get("departments")), "RH")),
                List.of("Consultez la répartition par département et par shift"), List.of(source("Base RH", "Vue administrative agrégée")), "HR");
        if (intent == Intent.PLANNING) return response("PLANNING", .97, "Vue Planning globale",
                String.format("Le portefeuille contient %d projet(s) et %d action(s). %d action(s) sont en retard et %d terminées.", number(pt.get("projects")), number(pt.get("actions")), planningRisk, number(pt.get("completedactions"))),
                List.of(kpi("Projets", number(pt.get("projects")), "PLANNING"), kpi("Actions", number(pt.get("actions")), "PLANNING"), kpi("En retard", planningRisk, planningRisk > 0 ? "DANGER" : "PLANNING")),
                planningRisk > 0 ? List.of("Prioriser le portefeuille ECR en retard") : List.of("Aucun retard global"), List.of(source("Base Planning", "Portefeuille ECR global")), "PLANNING");
        if (intent == Intent.TRACEABILITY) return response("TRACEABILITY", .97, "Vue Traçabilité globale",
                String.format("Le système contient %d lot(s), %d article(s) de stock et %d événement(s). %d signalement(s) sont ouverts.", number(tt.get("batches")), number(tt.get("stockitems")), number(tt.get("events")), traceRisk),
                List.of(kpi("Lots", number(tt.get("batches")), "TRACEABILITY"), kpi("Événements", number(tt.get("events")), "TRACEABILITY"), kpi("Signalements", traceRisk, traceRisk > 0 ? "DANGER" : "TRACEABILITY")),
                traceRisk > 0 ? List.of("Examiner les signalements non résolus") : List.of("Aucun signalement ouvert"), List.of(source("Base Traçabilité", "Stocks et événements globaux")), "TRACEABILITY");
        if (intent == Intent.COMPARISON) return comparison(traceRisk, 0, planningRisk);
        if (intent == Intent.HELP) return response("HELP", .99, "Capacités du copilote",
                "Je peux analyser les indicateurs globaux RH, Planning et Traçabilité, comparer leurs risques et identifier la priorité opérationnelle.",
                List.of(), List.of("Demandez une synthèse, une comparaison ou l’analyse d’un domaine"), List.of(source("Portail SAGE HUB", "Vue administrateur agrégée")), "ALL");
        long total = traceRisk + planningRisk;
        String focus = planningRisk >= traceRisk && planningRisk > 0 ? "Planning ECR" : traceRisk > 0 ? "Traçabilité" : "Aucun domaine";
        return response("OVERVIEW", .93, "Synthèse opérationnelle globale",
                total == 0 ? "Aucune urgence globale n’est actuellement détectée." : String.format("%d point(s) d’attention sont détectés. Le domaine prioritaire est %s.", total, focus),
                List.of(kpi("Collaborateurs", number(ht.get("employees")), "HR"), kpi("Signalements", traceRisk, traceRisk > 0 ? "DANGER" : "TRACEABILITY"), kpi("Actions en retard", planningRisk, planningRisk > 0 ? "DANGER" : "PLANNING")),
                orderedRecommendations(traceRisk, 0, planningRisk), List.of(source("Analyse croisée", "Données administratives des trois applications")), focus.startsWith("Planning") ? "PLANNING" : focus.startsWith("Traçabilité") ? "TRACEABILITY" : "ALL");
    }

    private Map<String, Object> overview(String name, long traceRisk, long hrRisk, long planningRisk, Map<String,Object> metrics, Map<String,Object> trace, Map<String,Object> hr, Map<String,Object> planning) {
        long total = traceRisk + hrRisk + planningRisk;
        String priority = planningRisk >= traceRisk && planningRisk >= hrRisk && planningRisk > 0 ? "le planning ECR"
                : traceRisk >= hrRisk && traceRisk > 0 ? "la traçabilité" : hrRisk > 0 ? "les ressources humaines" : "aucun domaine";
        return response("OVERVIEW", .91, "Votre synthèse intelligente",
                total == 0 ? name + ", aucune urgence n’est détectée dans vos applications aujourd’hui."
                        : String.format("%s, j’ai détecté %d point(s) d’attention. La priorité recommandée est %s, car ce domaine concentre actuellement le risque le plus important.", name, total, priority),
                List.of(kpi("Lots aujourd’hui", number(trace.get("lotsToday")), "TRACEABILITY"), kpi("Présence", text(hr.get("presenceStatus")), "RH"), kpi("Actions en retard", number(planning.get("lateActions")), planningRisk > 0 ? "DANGER" : "PLANNING"), kpi("Terminées", number(metrics.get("completedActions")), "SUCCESS")),
                total > 0 ? orderedRecommendations(traceRisk, hrRisk, planningRisk) : List.of("Poursuivre le suivi normal des trois applications"),
                List.of(source("Traçabilité", "Lots et anomalies"), source("RH", "Présence et demandes"), source("Planning", "Actions et échéances")), priority.contains("planning") ? "PLANNING" : priority.contains("traçabilité") ? "TRACEABILITY" : priority.contains("ressources") ? "HR" : "ALL");
    }

    private Map<String, Object> comparison(long traceRisk, long hrRisk, long planningRisk) {
        long max = Math.max(traceRisk, Math.max(hrRisk, planningRisk));
        String focus = max == 0 ? "Aucun domaine" : max == planningRisk ? "Planning ECR" : max == traceRisk ? "Traçabilité" : "Ressources humaines";
        return response("COMPARISON", .98, "Comparaison des risques",
                max == 0 ? "Les trois domaines sont actuellement sous contrôle." : focus + " concentre le plus de points d’attention. Je recommande de commencer par ce domaine.",
                List.of(kpi("Traçabilité", traceRisk, "TRACEABILITY"), kpi("RH", hrRisk, "RH"), kpi("Planning", planningRisk, "PLANNING")),
                orderedRecommendations(traceRisk, hrRisk, planningRisk),
                List.of(source("Analyse croisée", "Comparaison temps réel des trois applications")), max == planningRisk ? "PLANNING" : max == traceRisk ? "TRACEABILITY" : max == hrRisk ? "HR" : "ALL");
    }

    private Intent detect(String message, String view, List<AssistantRequest.HistoryMessage> history) {
        if (message.contains("compare") || message.contains("comparaison") || message.contains("entre les") || message.contains("trois applications")) return Intent.COMPARISON;
        if (Pattern.compile("(^| )rh( |$)").matcher(message).find() || message.contains("absence") || message.contains("presence") || message.contains("pointage")) return Intent.HR;
        if (message.contains("planning") || message.contains(" ecr") || message.startsWith("ecr")) return Intent.PLANNING;
        if (message.contains("tracabilite") || message.contains("lot") || message.contains("stock")) return Intent.TRACEABILITY;
        Map<Intent, Integer> scores = new EnumMap<>(Intent.class);
        score(scores, Intent.HR, message, "rh", "absence", "absent", "presence", "pointage", "employe", "demande", "conge", "equipe", "heure");
        score(scores, Intent.PLANNING, message, "planning", "ecr", "action", "retard", "projet", "echeance", "jalon", "deadline", "avancement");
        score(scores, Intent.TRACEABILITY, message, "tracabilite", "lot", "stock", "reception", "consommation", "anomalie", "controle", "expedition", "reference");
        score(scores, Intent.COMPARISON, message, "compare", "comparaison", "plus risque", "entre les", "trois applications");
        score(scores, Intent.HELP, message, "aide", "que peux tu", "capacites", "commandes", "exemples");
        score(scores, Intent.OVERVIEW, message, "resume", "synthese", "priorite", "aujourd hui", "situation", "risque", "urgent", "dois je faire");
        if (message.length() < 22 && history != null && !history.isEmpty()) {
            String previous = normalize(history.get(history.size() - 1).content());
            score(scores, Intent.HR, previous, "rh", "absence", "presence");
            score(scores, Intent.PLANNING, previous, "planning", "ecr", "action");
            score(scores, Intent.TRACEABILITY, previous, "tracabilite", "lot", "stock");
        }
        if (scores.values().stream().mapToInt(Integer::intValue).max().orElse(0) == 0 && view != null) {
            try { return Intent.valueOf(view.equals("ALL") ? "OVERVIEW" : view); } catch (IllegalArgumentException ignored) {}
        }
        return scores.entrySet().stream().max(Map.Entry.comparingByValue()).filter(e -> e.getValue() > 0).map(Map.Entry::getKey).orElse(Intent.OVERVIEW);
    }

    private void score(Map<Intent,Integer> scores, Intent intent, String text, String... terms) {
        int value = 0; for (String term : terms) if (text.contains(term)) value += term.contains(" ") ? 3 : 2;
        scores.put(intent, value);
    }
    private String normalize(String value) { return Pattern.compile("[^a-z0-9 ]").matcher(Normalizer.normalize(value == null ? "" : value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "")).replaceAll(" ").replaceAll("\\s+", " ").trim(); }
    private UserAccount account(String username) { return accounts.findByUsername(username).orElseThrow(); }
    private List<String> orderedRecommendations(long trace, long hr, long planning) { List<Map.Entry<String,Long>> all = new ArrayList<>(List.of(Map.entry("Traiter les actions ECR en retard", planning), Map.entry("Résoudre les anomalies de traçabilité", trace), Map.entry("Examiner les demandes et absences RH", hr))); all.sort((a,b)->Long.compare(b.getValue(),a.getValue())); return all.stream().filter(e->e.getValue()>0).map(e->e.getKey()+" ("+e.getValue()+")").toList(); }
    private Map<String,Object> response(String intent,double confidence,String title,String answer,List<Map<String,Object>> cards,List<String> insights,List<Map<String,Object>> sources,String action) { Map<String,Object> out=new LinkedHashMap<>(); out.put("id",UUID.randomUUID().toString());out.put("createdAt",Instant.now().toString());out.put("intent",intent);out.put("confidence",confidence);out.put("title",title);out.put("answer",answer);out.put("cards",cards);out.put("insights",insights);out.put("sources",sources);out.put("action",Map.of("label", action.equals("ALL") ? "Voir la vue globale" : "Ouvrir le dashboard concerné", "view",action));out.put("suggestions",suggestions(intent));return out; }
    private List<String> suggestions(String intent) { return switch(intent){case "HR"->List.of("Analyse mes absences", "Ai-je des demandes en attente ?", "Quelle est ma priorité aujourd’hui ?");case "PLANNING"->List.of("Combien d’actions sont en retard ?", "Compare avec les autres applications", "Résume ma journée");case "TRACEABILITY"->List.of("Y a-t-il des anomalies ouvertes ?", "Compare les risques", "Résume ma journée");default->List.of("Quelle est ma priorité aujourd’hui ?", "Compare les risques des trois applications", "Analyse mon planning ECR");}; }
    private Map<String,Object> kpi(String label,Object value,String tone){return Map.of("label",label,"value",value==null?"—":value,"tone",tone);}
    private Map<String,Object> source(String label,String detail){return Map.of("label",label,"detail",detail);}
    @SuppressWarnings("unchecked") private Map<String,Object> map(Object value){return value instanceof Map<?,?> m?(Map<String,Object>)m:Map.of();}
    private long number(Object value){return value instanceof Number n?n.longValue():0;}
    private String decimal(Object value){return value instanceof Number n?String.format(Locale.FRANCE,"%.1f",n.doubleValue()):"—";}
    private String text(Object value){return value==null?"—":String.valueOf(value);}
    private boolean blank(String value){return value==null||value.isBlank()||value.equals("—");}
    private enum Intent { OVERVIEW, HR, PLANNING, TRACEABILITY, COMPARISON, HELP }
}
