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
    @Published var visibleDepthLimit: Int = 1
    @Published var layoutMode: MindMapLayoutMode = .radial
    @Published var searchText: String = ""
    @Published var activeSearchIndex: Int = -1
    @Published var errorMessage: String?
    @Published var recenterRequestID = UUID()
    @Published var cutNodeID: UUID?

    private let store: MapStoring

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
        root.visible(expandedIDs: expandedIDs, initialDepthLimit: visibleDepthLimit)
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
        visibleDepthLimit = 1
        searchText = ""
        activeSearchIndex = -1
    }

    func createMap(title: String) {
        let clean = title.trimmedOrUntitled
        loadMarkdown("# \(clean)", name: clean)
        saveCurrentMap()
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

    func selectAndToggle(_ nodeID: UUID) {
        guard let node = root.node(id: nodeID) else { return }
        selectedNodeID = nodeID

        guard !node.children.isEmpty else {
            revealAncestors(to: nodeID)
            return
        }

        if nodeID == root.id {
            if visibleDepthLimit == 0 {
                visibleDepthLimit = 1
            } else {
                visibleDepthLimit = 0
                expandedIDs.removeAll()
            }
            return
        }

        if expandedIDs.contains(nodeID) {
            collapseNode(nodeID)
        } else {
            revealAncestors(to: nodeID)
            expandedIDs.insert(nodeID)
        }
    }

    func hasChildren(_ nodeID: UUID) -> Bool {
        root.node(id: nodeID)?.children.isEmpty == false
    }

    func isExpanded(_ nodeID: UUID) -> Bool {
        if nodeID == root.id {
            return visibleDepthLimit > 0 || expandedIDs.contains(nodeID)
        }
        return expandedIDs.contains(nodeID)
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
        saveCurrentMap()
        return added
    }

    func renameNode(_ nodeID: UUID, title: String) {
        guard root.rename(id: nodeID, title: title) else { return }
        if nodeID == root.id {
            activeMapName = root.title
        }
        saveCurrentMap()
    }

    func deleteSelectedNode() {
        guard let selectedNodeID, selectedNodeID != root.id else { return }
        let parent = root.parent(of: selectedNodeID)
        let removed = root.remove(id: selectedNodeID)
        expandedIDs.remove(selectedNodeID)
        if let cutNodeID, removed?.node(id: cutNodeID) != nil {
            self.cutNodeID = nil
        }
        self.selectedNodeID = parent?.id ?? root.id
        saveCurrentMap()
    }

    func cutNode(_ nodeID: UUID) {
        guard nodeID != root.id, root.node(id: nodeID) != nil else { return }
        cutNodeID = nodeID
        selectedNodeID = nodeID
    }

    func cancelCutNode() {
        cutNodeID = nil
    }

    func canPasteCutNode(on targetID: UUID) -> Bool {
        guard let cutNodeID,
              cutNodeID != root.id,
              cutNodeID != targetID,
              let cutNode = root.node(id: cutNodeID),
              root.node(id: targetID) != nil else {
            return false
        }

        return cutNode.node(id: targetID) == nil
    }

    @discardableResult
    func pasteCutNode(on targetID: UUID) -> Bool {
        guard let cutNodeID, canPasteCutNode(on: targetID),
              let moved = root.moveSubtree(id: cutNodeID, to: targetID) else {
            errorMessage = "Impossible de coller ce nœud ici."
            return false
        }

        self.cutNodeID = nil
        selectedNodeID = moved.id
        expandedIDs.insert(targetID)
        expandedIDs.insert(moved.id)
        revealPath(to: moved.id)
        activeMapName = root.title
        saveCurrentMap()
        return true
    }

    var cutNodeTitle: String? {
        guard let cutNodeID else { return nil }
        return root.node(id: cutNodeID)?.title
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

    func requestRecenter() {
        recenterRequestID = UUID()
    }

    func toggleLayoutMode() {
        layoutMode = layoutMode == .radial ? .right : .radial
    }

    func collapseOneLevel() {
        let visibleNodes = visibleRoot.flattened
        let deepestVisibleDepth = visibleNodes.map(\.depth).max() ?? 0

        guard deepestVisibleDepth > 0 else {
            selectedNodeID = root.id
            return
        }

        if deepestVisibleDepth <= visibleDepthLimit {
            visibleDepthLimit = max(0, visibleDepthLimit - 1)
            if visibleDepthLimit == 0 {
                expandedIDs.removeAll()
            } else {
                trimExpandedIDs(maxDepth: visibleDepthLimit)
            }
        } else {
            let parentDepthToCollapse = deepestVisibleDepth - 1
            expandedIDs.subtract(
                root.flattened
                    .filter { $0.depth == parentDepthToCollapse }
                    .map(\.id)
            )
        }

        let remainingVisibleIDs = Set(visibleRoot.flattened.map(\.id))
        if let selectedNodeID, !remainingVisibleIDs.contains(selectedNodeID) {
            self.selectedNodeID = root.id
        }
    }

    private var existingMap: SavedMindMap? {
        guard let activeMapID else { return nil }
        return savedMaps.first { $0.id == activeMapID }
    }

    private func revealPath(to nodeID: UUID) {
        guard let path = root.path(to: nodeID) else { return }
        expandedIDs.formUnion(path)
        visibleDepthLimit = max(visibleDepthLimit, min(1, root.node(id: nodeID)?.depth ?? 0))
    }

    private func revealAncestors(to nodeID: UUID) {
        guard let path = root.path(to: nodeID) else { return }
        expandedIDs.formUnion(path.dropLast())
        if path.count > 1 {
            visibleDepthLimit = max(visibleDepthLimit, 1)
        }
    }

    private func collapseNode(_ nodeID: UUID) {
        guard let node = root.node(id: nodeID) else { return }
        expandedIDs.subtract(node.flattened.map(\.id))
    }

    private func trimExpandedIDs(maxDepth: Int) {
        let allowed = Set(root.flattened.filter { $0.depth <= maxDepth }.map(\.id))
        expandedIDs = expandedIDs.intersection(allowed)
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
