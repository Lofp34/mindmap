import Foundation

protocol MapStoring {
    func loadMaps() throws -> [SavedMindMap]
    func saveMaps(_ maps: [SavedMindMap]) throws
}

struct LocalMapStore: MapStoring {
    let fileURL: URL

    init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
        } else {
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            self.fileURL = documents.appendingPathComponent("mind-maps.json")
        }
    }

    func loadMaps() throws -> [SavedMindMap] {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return [] }
        let data = try Data(contentsOf: fileURL)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([SavedMindMap].self, from: data)
    }

    func saveMaps(_ maps: [SavedMindMap]) throws {
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(maps)
        try data.write(to: fileURL, options: [.atomic])
    }
}

enum BuiltInTemplates {
    static let all: [BuiltInTemplate] = [
        BuiltInTemplate(
            id: "aida",
            name: "AIDA",
            description: "Attention, intérêt, désir, action",
            markdown: """
            # AIDA
            ## Attention
            ### Accroche principale
            ### Problème visible
            ### Promesse claire
            ## Intérêt
            ### Contexte client
            ### Bénéfices concrets
            ### Preuves ou exemples
            ## Désir
            ### Transformation attendue
            ### Différenciation
            ### Objections à lever
            ## Action
            ### Prochaine étape
            ### Message d'appel à l'action
            ### Suivi
            """
        ),
        BuiltInTemplate(
            id: "omar",
            name: "OMAR",
            description: "Objectif, moyens, actions, rendez-vous, résultats",
            markdown: """
            # OMAR - Développer mon business
            ## Objectif
            ### Développer mon business
            ### Clarifier mon ambition commerciale
            ## Moyens
            ### Temps disponible
            ### Canaux d'acquisition
            ### Ressources existantes
            ## Actions
            ### Prioriser les opportunités
            ### Préparer les messages
            ### Définir la cadence
            ## Rendez-vous
            ### Planifier les relances
            ### Qualifier les prospects
            ## Résultats
            ### Mesurer les conversions
            ### Ajuster la stratégie
            """
        ),
        BuiltInTemplate(
            id: "diagnostic",
            name: "Diagnostic",
            description: "Situation, causes, risques, décisions",
            markdown: """
            # Diagnostic
            ## Situation actuelle
            ### Faits observés
            ### Chiffres disponibles
            ### Signaux faibles
            ## Causes probables
            ### Organisation
            ### Offre
            ### Processus
            ## Risques
            ### Court terme
            ### Moyen terme
            ## Décisions
            ### À faire maintenant
            ### À surveiller
            ### À abandonner
            """
        )
    ]
}
