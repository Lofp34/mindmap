import Foundation
import SwiftUI

@MainActor
final class MindMapAppModel: ObservableObject {
    @Published var root: MindMapNode
    @Published var savedMaps: [SavedMindMap] = []
    @Published var activeMapID: UUID?
    @Published var activeMapName: String = "Exemple intégré"
    @Published var selectedNodeID: UUID?
    @Published var expandedIDs: Set<UUID> = []
    @Published var layoutMode: MindMapLayoutMode = .radial
    @Published var searchText: String = ""
    @Published var activeSearchIndex: Int = -1
    @Published var errorMessage: String?

    private let store: MapStoring
    private let initialDepthLimit = 1

    init(store: MapStoring = LocalMapStore()) {
        self.store = store
        self.root = MarkdownMindMapParser.parse(Self.sampleMarkdown)
        self.selectedNodeID = root.id
        loadSavedMaps()
    }

    var markdown: String {
        root.markdown()
    }

    var visibleRoot: MindMapNode {
        root.visible(expandedIDs: expandedIDs, initialDepthLimit: initialDepthLimit)
    }

    var selectedNode: MindMapNode? {
        guard let selectedNodeID else { return nil }
        return root.node(id: selectedNodeID)
    }

    var activeMaps: [SavedMindMap] {
        savedMaps
            .filter { $0.archivedAt == nil && $0.templateAt == nil }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var archivedMaps: [SavedMindMap] {
        savedMaps
            .filter { $0.archivedAt != nil }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var customTemplates: [SavedMindMap] {
        savedMaps
            .filter { $0.archivedAt == nil && $0.templateAt != nil }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var searchMatches: [UUID] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return [] }
        return root.flattened
            .filter { $0.title.range(of: query, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
            .map(\.id)
    }

    func loadMarkdown(_ markdown: String, name: String? = nil, id: UUID? = nil) {
        root = MarkdownMindMapParser.parse(markdown)
        activeMapID = id
        activeMapName = name ?? root.title
        selectedNodeID = root.id
        expandedIDs = []
        searchText = ""
        activeSearchIndex = -1
    }

    func createMap(title: String) {
        let clean = title.trimmedOrUntitled
        loadMarkdown("# \(clean)", name: clean)
    }

    func updateFromSource(_ source: String) {
        loadMarkdown(source, name: activeMapName, id: activeMapID)
    }

    func saveCurrentMap() {
        let now = Date()
        let saved = SavedMindMap(
            id: activeMapID ?? UUID(),
            name: root.title,
            markdown: markdown,
            updatedAt: now,
            archivedAt: nil,
            templateAt: existingMap?.templateAt
        )
        upsertAtTop(saved)
        activeMapID = saved.id
        activeMapName = saved.name
        persist()
    }

    func saveCurrentAsTemplate() {
        let now = Date()
        let saved = SavedMindMap(
            id: activeMapID ?? UUID(),
            name: root.title,
            markdown: markdown,
            updatedAt: now,
            archivedAt: nil,
            templateAt: now
        )
        upsertAtTop(saved)
        activeMapID = saved.id
        activeMapName = saved.name
        persist()
    }

    func open(_ map: SavedMindMap) {
        loadMarkdown(map.markdown, name: map.name, id: map.id)
    }

    func openTemplate(_ template: BuiltInTemplate) {
        loadMarkdown(template.markdown, name: template.name)
    }

    func archive(_ map: SavedMindMap) {
        var archived = map
        archived.archivedAt = Date()
        archived.updatedAt = Date()
        upsertAtTop(archived)
        if activeMapID == map.id {
            activeMapID = nil
        }
        persist()
    }

    func delete(_ map: SavedMindMap) {
        savedMaps.removeAll { $0.id == map.id }
        if activeMapID == map.id {
            activeMapID = nil
        }
        persist()
    }

    func selectAndExpand(_ nodeID: UUID) {
        selectedNodeID = nodeID
        expandedIDs.insert(nodeID)
        revealPath(to: nodeID)
    }

    @discardableResult
    func addNode(action: NodeInsertAction, referenceID: UUID, title: String) -> MindMapNode? {
        let clean = title.trimmedOrUntitled
        let added: MindMapNode?

        switch action {
        case .child:
            added = root.addChild(to: referenceID, title: clean)
            expandedIDs.insert(referenceID)
        case .sibling:
            added = root.addSibling(after: referenceID, title: clean)
            if let parent = root.parent(of: referenceID) {
                expandedIDs.insert(parent.id)
            }
        }

        guard let added else { return nil }
        selectedNodeID = added.id
        revealPath(to: added.id)
        activeMapName = root.title
        return added
    }

    func renameNode(_ nodeID: UUID, title: String) {
        guard root.rename(id: nodeID, title: title) else { return }
        if nodeID == root.id {
            activeMapName = root.title
        }
    }

    func deleteSelectedNode() {
        guard let selectedNodeID, selectedNodeID != root.id else { return }
        let parent = root.parent(of: selectedNodeID)
        _ = root.remove(id: selectedNodeID)
        expandedIDs.remove(selectedNodeID)
        self.selectedNodeID = parent?.id ?? root.id
    }

    func focusSearchResult(offset: Int) -> UUID? {
        let matches = searchMatches
        guard !matches.isEmpty else {
            activeSearchIndex = -1
            return nil
        }

        let nextIndex: Int
        if activeSearchIndex < 0 {
            nextIndex = offset < 0 ? matches.count - 1 : 0
        } else {
            nextIndex = (activeSearchIndex + offset + matches.count) % matches.count
        }

        activeSearchIndex = nextIndex
        let id = matches[nextIndex]
        selectAndExpand(id)
        return id
    }

    func resetSearchFocus() -> UUID? {
        activeSearchIndex = -1
        return focusSearchResult(offset: 1)
    }

    private var existingMap: SavedMindMap? {
        guard let activeMapID else { return nil }
        return savedMaps.first { $0.id == activeMapID }
    }

    private func revealPath(to nodeID: UUID) {
        guard let path = root.path(to: nodeID) else { return }
        expandedIDs.formUnion(path)
    }

    private func loadSavedMaps() {
        do {
            savedMaps = try store.loadMaps()
        } catch {
            errorMessage = "Impossible de charger les cartes enregistrées."
            savedMaps = []
        }
    }

    private func persist() {
        do {
            try store.saveMaps(savedMaps)
        } catch {
            errorMessage = "Impossible d'enregistrer la carte."
        }
    }

    private func upsertAtTop(_ map: SavedMindMap) {
        savedMaps.removeAll { $0.id == map.id }
        savedMaps.insert(map, at: 0)
    }

    static let sampleMarkdown = """
    # Projet IA personnel
    ## Idées
    ### Importer des fichiers Markdown
    ### Nettoyer les titres générés par IA
    ### Garder les notes importantes
    ## Plan d'action
    ### Prototype web
    ### Test sur iPhone
    ### Export image
    ## Contraintes
    ### Utilisation hors ligne
    ### Gestes tactiles simples
    ### Réorganisation automatique
    ## Opportunités
    ### Partage rapide
    ### Plusieurs cartes
    ### Modèles visuels
    """
}
