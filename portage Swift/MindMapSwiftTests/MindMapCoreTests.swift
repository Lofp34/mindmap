import XCTest
@testable import MindMapSwift

final class MindMapCoreTests: XCTestCase {
    func testParserBuildsHeadingHierarchy() {
        let markdown = """
        # Projet
        ## Idées
        ### Importer
        ### Nettoyer
        ## Action
        - Tester
        """

        let root = MarkdownMindMapParser.parse(markdown)

        XCTAssertEqual(root.title, "Projet")
        XCTAssertEqual(root.children.map(\.title), ["Idées", "Action"])
        XCTAssertEqual(root.children[0].children.map(\.title), ["Importer", "Nettoyer"])
        XCTAssertEqual(root.children[1].children.map(\.title), ["Tester"])
    }

    func testTreeEditsSerializeBackToMarkdown() {
        var root = MarkdownMindMapParser.parse("# Carte\n## Branche")
        let branch = root.children[0]

        let child = root.addChild(to: branch.id, title: "Sous sujet")
        XCTAssertNotNil(child)
        _ = root.addSibling(after: child!.id, title: "Autre sous sujet")
        _ = root.rename(id: branch.id, title: "Branche renommée")

        XCTAssertEqual(root.markdown(), """
        # Carte
        ## Branche renommée
        ### Sous sujet
        ### Autre sous sujet
        """)
    }

    func testMoveSubtreeKeepsChildren() {
        var root = MarkdownMindMapParser.parse("""
        # Carte
        ## A
        ### A1
        #### A1a
        ## B
        """)

        let sourceID = root.children[0].id
        let targetID = root.children[1].id
        let moved = root.moveSubtree(id: sourceID, to: targetID)

        XCTAssertEqual(moved?.title, "A")
        XCTAssertEqual(root.children.map(\.title), ["B"])
        XCTAssertEqual(root.children[0].children.map(\.title), ["A"])
        XCTAssertEqual(root.children[0].children[0].children.map(\.title), ["A1"])
        XCTAssertEqual(root.children[0].children[0].children[0].children.map(\.title), ["A1a"])
    }

    func testVisibleTreeShowsOneExpandedBranch() {
        let root = MarkdownMindMapParser.parse("""
        # Carte
        ## A
        ### A1
        ### A2
        ## B
        ### B1
        """)

        let firstBranchID = root.children[0].id
        let visible = root.visible(expandedIDs: [firstBranchID], initialDepthLimit: 1)

        XCTAssertEqual(visible.children.count, 2)
        XCTAssertEqual(visible.children[0].children.map(\.title), ["A1", "A2"])
        XCTAssertEqual(visible.children[1].children, [])
    }

    @MainActor
    func testShortTapTogglesNodeOpenAndClosed() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let model = MindMapAppModel(store: LocalMapStore(fileURL: url))
        model.loadMarkdown("""
        # Carte
        ## A
        ### A1
        ## B
        """)

        let branchID = model.root.children[0].id
        model.selectAndToggle(branchID)
        XCTAssertEqual(model.visibleRoot.children[0].children.map(\.title), ["A1"])

        model.selectAndToggle(branchID)
        XCTAssertEqual(model.visibleRoot.children[0].children, [])
    }

    func testVisibleTreeCanShowOnlyCentralNode() {
        let root = MarkdownMindMapParser.parse("""
        # Carte
        ## A
        ## B
        """)

        let visible = root.visible(expandedIDs: [], initialDepthLimit: 0)

        XCTAssertEqual(visible.title, "Carte")
        XCTAssertEqual(visible.children, [])
    }

    @MainActor
    func testSaveMovesArchivedMapBackToSavedMaps() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let store = LocalMapStore(fileURL: url)
        let model = MindMapAppModel(store: store)

        model.createMap(title: "Carte archive")
        model.saveCurrentMap()
        let saved = model.activeMaps[0]
        model.archive(saved)
        let archivedCount = model.archivedMaps.count
        XCTAssertEqual(archivedCount, 1)

        model.open(model.archivedMaps[0])
        model.saveCurrentMap()

        let remainingArchiveCount = model.archivedMaps.count
        let firstActiveName = model.activeMaps.first?.name
        XCTAssertEqual(remainingArchiveCount, 0)
        XCTAssertEqual(firstActiveName, "Carte archive")
    }

    func testRadialLayoutHasNodesAndLinks() {
        let root = MarkdownMindMapParser.parse("""
        # Carte
        ## A
        ### A1
        ## B
        ### B1
        """)
        let visible = root.visible(expandedIDs: [root.children[0].id, root.children[1].id], initialDepthLimit: 1)
        let layout = MindMapLayoutEngine.layout(root: visible, mode: .radial)

        XCTAssertEqual(layout.nodes.count, 5)
        XCTAssertEqual(layout.links.count, 4)
        XCTAssertTrue(layout.nodes.allSatisfy { $0.size.width > 0 && $0.size.height > 0 })
    }

    @MainActor
    func testCutPasteMovesNodeUnderTappedTarget() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let model = MindMapAppModel(store: LocalMapStore(fileURL: url))
        model.loadMarkdown("""
        # Carte
        ## A
        ### A1
        ## B
        """)

        let sourceID = model.root.children[0].id
        let targetID = model.root.children[1].id

        model.cutNode(sourceID)
        XCTAssertTrue(model.canPasteCutNode(on: targetID))
        XCTAssertFalse(model.canPasteCutNode(on: sourceID))
        XCTAssertTrue(model.pasteCutNode(on: targetID))

        XCTAssertNil(model.cutNodeID)
        XCTAssertEqual(model.root.children.map(\.title), ["B"])
        XCTAssertEqual(model.root.children[0].children.map(\.title), ["A"])
        XCTAssertEqual(model.root.children[0].children[0].children.map(\.title), ["A1"])
    }

    @MainActor
    func testCollapseOneLevelEventuallyKeepsOnlyCentralNode() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let model = MindMapAppModel(store: LocalMapStore(fileURL: url))
        model.loadMarkdown("""
        # Carte
        ## A
        ### A1
        #### A1a
        ## B
        ### B1
        """)

        model.selectAndExpand(model.root.children[0].id)
        model.selectAndExpand(model.root.children[0].children[0].id)
        XCTAssertGreaterThan(model.visibleRoot.flattened.count, 1)

        model.collapseOneLevel()
        model.collapseOneLevel()
        model.collapseOneLevel()

        XCTAssertEqual(model.visibleRoot.flattened.map(\.title), ["Carte"])
    }

    @MainActor
    func testVisibleLevelChoicesMatchCurrentlyDisplayedDepth() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let model = MindMapAppModel(store: LocalMapStore(fileURL: url))
        model.loadMarkdown("""
        # Carte
        ## A
        ### A1
        #### A1a
        ## B
        ### B1
        """)

        XCTAssertEqual(model.visibleLevelChoices, [1])

        model.selectAndExpand(model.root.children[0].id)
        XCTAssertEqual(model.visibleLevelChoices, [1, 2])

        model.selectAndExpand(model.root.children[0].children[0].id)
        XCTAssertEqual(model.visibleLevelChoices, [1, 2, 3])
    }

    @MainActor
    func testDisplayLevelsShowsRequestedDepth() {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("json")
        let model = MindMapAppModel(store: LocalMapStore(fileURL: url))
        model.loadMarkdown("""
        # Carte
        ## A
        ### A1
        #### A1a
        ## B
        ### B1
        #### B1a
        """)

        model.selectAndExpand(model.root.children[0].id)
        model.selectAndExpand(model.root.children[0].children[0].id)
        XCTAssertTrue(model.visibleRoot.flattened.contains { $0.title == "A1a" })

        model.displayLevels(2)

        XCTAssertEqual(model.visibleRoot.children.map(\.title), ["A", "B"])
        XCTAssertEqual(model.visibleRoot.children[0].children.map(\.title), ["A1"])
        XCTAssertEqual(model.visibleRoot.children[1].children.map(\.title), ["B1"])
        XCTAssertFalse(model.visibleRoot.flattened.contains { $0.title == "A1a" })
        XCTAssertFalse(model.visibleRoot.flattened.contains { $0.title == "B1a" })

        model.displayLevels(1)

        XCTAssertEqual(model.visibleRoot.children.map(\.title), ["A", "B"])
        XCTAssertEqual(model.visibleRoot.children[0].children, [])
        XCTAssertEqual(model.selectedNodeID, model.root.id)
    }
}
