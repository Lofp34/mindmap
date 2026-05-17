import CoreGraphics
import Foundation

struct MindMapNode: Identifiable, Codable, Equatable, Hashable {
    var id: UUID
    var title: String
    var depth: Int
    var children: [MindMapNode]

    init(id: UUID = UUID(), title: String, depth: Int = 0, children: [MindMapNode] = []) {
        self.id = id
        self.title = title.trimmedOrUntitled
        self.depth = depth
        self.children = children
    }
}

struct SavedMindMap: Identifiable, Codable, Equatable {
    var id: UUID
    var name: String
    var markdown: String
    var updatedAt: Date
    var archivedAt: Date?
    var templateAt: Date?

    init(
        id: UUID = UUID(),
        name: String,
        markdown: String,
        updatedAt: Date = Date(),
        archivedAt: Date? = nil,
        templateAt: Date? = nil
    ) {
        self.id = id
        self.name = name.trimmedOrUntitled
        self.markdown = markdown
        self.updatedAt = updatedAt
        self.archivedAt = archivedAt
        self.templateAt = templateAt
    }
}

struct LayoutNode: Identifiable, Equatable {
    let id: UUID
    let title: String
    let depth: Int
    let position: CGPoint
    let size: CGSize
    let isRoot: Bool
    let sourceNode: MindMapNode

    var rect: CGRect {
        CGRect(
            x: position.x - size.width / 2,
            y: position.y - size.height / 2,
            width: size.width,
            height: size.height
        )
    }
}

struct LayoutLink: Identifiable, Equatable {
    let id = UUID()
    let source: UUID
    let target: UUID
}

struct MindMapLayoutResult: Equatable {
    var nodes: [LayoutNode]
    var links: [LayoutLink]
    var contentSize: CGSize

    var nodeByID: [UUID: LayoutNode] {
        Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
    }
}

enum MindMapLayoutMode: String, CaseIterable, Identifiable {
    case radial
    case right

    var id: String { rawValue }

    var label: String {
        switch self {
        case .radial: return "Horloge"
        case .right: return "Vue droite"
        }
    }
}

enum NodeInsertAction: Equatable {
    case child
    case sibling

    var label: String {
        switch self {
        case .child: return "enfant"
        case .sibling: return "frère"
        }
    }
}

struct NodeCreationRequest: Identifiable, Equatable {
    let id = UUID()
    var action: NodeInsertAction
    var referenceID: UUID
}

struct RenameRequest: Identifiable, Equatable {
    let id = UUID()
    var nodeID: UUID
    var currentTitle: String
}

struct BuiltInTemplate: Identifiable, Equatable {
    var id: String
    var name: String
    var description: String
    var markdown: String
}

extension String {
    var trimmedOrUntitled: String {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? "Sans titre" : value
    }
}
