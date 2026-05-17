import Foundation

extension MindMapNode {
    func node(id searchID: UUID) -> MindMapNode? {
        if id == searchID { return self }
        for child in children {
            if let match = child.node(id: searchID) {
                return match
            }
        }
        return nil
    }

    func parent(of searchID: UUID) -> MindMapNode? {
        for child in children {
            if child.id == searchID { return self }
            if let match = child.parent(of: searchID) {
                return match
            }
        }
        return nil
    }

    var flattened: [MindMapNode] {
        [self] + children.flatMap(\.flattened)
    }

    func visible(expandedIDs: Set<UUID>, initialDepthLimit: Int = 1) -> MindMapNode {
        var copy = self
        copy.children = children.compactMap { child in
            child.visibleCopy(expandedIDs: expandedIDs, initialDepthLimit: initialDepthLimit, parentShowsChildren: true)
        }
        return copy
    }

    private func visibleCopy(
        expandedIDs: Set<UUID>,
        initialDepthLimit: Int,
        parentShowsChildren: Bool
    ) -> MindMapNode? {
        guard parentShowsChildren || depth <= initialDepthLimit || expandedIDs.contains(id) || depth == 0 else {
            return nil
        }

        var copy = self
        let shouldShowChildren = depth < initialDepthLimit || expandedIDs.contains(id)
        copy.children = shouldShowChildren
            ? children.compactMap {
                $0.visibleCopy(
                    expandedIDs: expandedIDs,
                    initialDepthLimit: initialDepthLimit,
                    parentShowsChildren: true
                )
            }
            : []
        return copy
    }

    func markdown() -> String {
        markdownLines().joined(separator: "\n")
    }

    private func markdownLines() -> [String] {
        let headingLevel = min(depth + 1, 6)
        let prefix = String(repeating: "#", count: headingLevel)
        var lines = ["\(prefix) \(title)"]
        for child in children {
            lines.append(contentsOf: child.markdownLines())
        }
        return lines
    }

    mutating func addChild(to parentID: UUID, title: String) -> MindMapNode? {
        if id == parentID {
            let child = MindMapNode(title: title, depth: depth + 1)
            children.append(child)
            normalizeDepths()
            return child
        }

        for index in children.indices {
            if let child = children[index].addChild(to: parentID, title: title) {
                normalizeDepths()
                return child
            }
        }

        return nil
    }

    mutating func addSibling(after siblingID: UUID, title: String) -> MindMapNode? {
        for index in children.indices {
            if children[index].id == siblingID {
                let sibling = MindMapNode(title: title, depth: depth + 1)
                children.insert(sibling, at: index + 1)
                normalizeDepths()
                return sibling
            }
        }

        for index in children.indices {
            if let sibling = children[index].addSibling(after: siblingID, title: title) {
                normalizeDepths()
                return sibling
            }
        }

        return nil
    }

    mutating func remove(id removeID: UUID) -> MindMapNode? {
        for index in children.indices {
            if children[index].id == removeID {
                return children.remove(at: index)
            }
        }

        for index in children.indices {
            if let removed = children[index].remove(id: removeID) {
                normalizeDepths()
                return removed
            }
        }

        return nil
    }

    mutating func rename(id renameID: UUID, title: String) -> Bool {
        if id == renameID {
            self.title = title.trimmedOrUntitled
            return true
        }

        for index in children.indices {
            if children[index].rename(id: renameID, title: title) {
                return true
            }
        }

        return false
    }

    mutating func normalizeDepths(depth newDepth: Int = 0) {
        depth = newDepth
        for index in children.indices {
            children[index].normalizeDepths(depth: newDepth + 1)
        }
    }

    func path(to searchID: UUID, current: [UUID] = []) -> [UUID]? {
        let next = current + [id]
        if id == searchID { return next }
        for child in children {
            if let match = child.path(to: searchID, current: next) {
                return match
            }
        }
        return nil
    }
}
