import CoreGraphics
import Foundation

enum MindMapLayoutEngine {
    static func layout(
        root: MindMapNode,
        mode: MindMapLayoutMode,
        viewport: CGSize = CGSize(width: 1200, height: 900)
    ) -> MindMapLayoutResult {
        switch mode {
        case .radial:
            return radialLayout(root: root, viewport: viewport)
        case .right:
            return rightLayout(root: root, viewport: viewport)
        }
    }

    static func measuredSize(for node: MindMapNode) -> CGSize {
        let lineCount = wrappedLines(for: node.title, maxCharacters: node.depth == 0 ? 30 : 28).count
        let longest = wrappedLines(for: node.title, maxCharacters: node.depth == 0 ? 30 : 28)
            .map(\.count)
            .max() ?? 10
        let width = node.depth == 0
            ? CGFloat(max(240, min(340, longest * 9 + 64)))
            : CGFloat(max(170, min(330, longest * 8 + 48)))
        let height = CGFloat(max(node.depth == 0 ? 72 : 54, lineCount * 20 + (node.depth == 0 ? 34 : 28)))
        return CGSize(width: width, height: height)
    }

    static func wrappedLines(for title: String, maxCharacters: Int) -> [String] {
        let words = title.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !words.isEmpty else { return ["Sans titre"] }

        var lines: [String] = []
        var current = ""

        for word in words {
            let chunks = splitLongWord(word, maxCharacters: maxCharacters)
            for chunk in chunks {
                let next = current.isEmpty ? chunk : "\(current) \(chunk)"
                if next.count > maxCharacters, !current.isEmpty {
                    lines.append(current)
                    current = chunk
                } else {
                    current = next
                }
            }
        }

        if !current.isEmpty { lines.append(current) }
        return lines
    }

    private static func splitLongWord(_ word: String, maxCharacters: Int) -> [String] {
        guard word.count > maxCharacters else { return [word] }
        var chunks: [String] = []
        var remaining = word
        while remaining.count > maxCharacters {
            let index = remaining.index(remaining.startIndex, offsetBy: maxCharacters)
            chunks.append(String(remaining[..<index]))
            remaining = String(remaining[index...])
        }
        if !remaining.isEmpty { chunks.append(remaining) }
        return chunks
    }

    private static func radialLayout(root: MindMapNode, viewport: CGSize) -> MindMapLayoutResult {
        let center = CGPoint(x: viewport.width / 2, y: viewport.height / 2)
        var nodes: [LayoutNode] = []
        var links: [LayoutLink] = []
        var positions: [UUID: CGPoint] = [root.id: center]

        let radiusStep: CGFloat = 245
        let branchWeights = root.children.map { max(1, leafWeight($0)) }
        let totalWeight = max(1, branchWeights.reduce(0, +))
        var cursor = -CGFloat.pi / 2

        for (index, child) in root.children.enumerated() {
            let sweep = (CGFloat(branchWeights[index]) / CGFloat(totalWeight)) * (CGFloat.pi * 2)
            layoutRadialNode(
                child,
                parentID: root.id,
                startAngle: cursor,
                endAngle: cursor + sweep,
                center: center,
                radiusStep: radiusStep,
                positions: &positions,
                links: &links
            )
            cursor += sweep
        }

        collectLayoutNodes(root, positions: positions, nodes: &nodes)
        resolveOverlaps(nodes: &nodes, center: center)
        let contentSize = boundingSize(nodes: nodes, fallback: viewport)
        return MindMapLayoutResult(nodes: nodes, links: links, contentSize: contentSize)
    }

    private static func layoutRadialNode(
        _ node: MindMapNode,
        parentID: UUID,
        startAngle: CGFloat,
        endAngle: CGFloat,
        center: CGPoint,
        radiusStep: CGFloat,
        positions: inout [UUID: CGPoint],
        links: inout [LayoutLink]
    ) {
        let angle = (startAngle + endAngle) / 2
        let radius = CGFloat(max(1, node.depth)) * radiusStep
        positions[node.id] = CGPoint(
            x: center.x + cos(angle) * radius,
            y: center.y + sin(angle) * radius
        )
        links.append(LayoutLink(source: parentID, target: node.id))

        guard !node.children.isEmpty else { return }

        let weights = node.children.map { max(1, leafWeight($0)) }
        let total = max(1, weights.reduce(0, +))
        let availableSweep = min(endAngle - startAngle, CGFloat.pi * 0.95)
        var cursor = angle - availableSweep / 2

        for (index, child) in node.children.enumerated() {
            let childSweep = (CGFloat(weights[index]) / CGFloat(total)) * availableSweep
            layoutRadialNode(
                child,
                parentID: node.id,
                startAngle: cursor,
                endAngle: cursor + childSweep,
                center: center,
                radiusStep: radiusStep,
                positions: &positions,
                links: &links
            )
            cursor += childSweep
        }
    }

    private static func rightLayout(root: MindMapNode, viewport: CGSize) -> MindMapLayoutResult {
        let leaves = max(1, leafWeight(root))
        let verticalStep: CGFloat = 94
        let horizontalStep: CGFloat = 285
        let height = max(viewport.height, CGFloat(leaves) * verticalStep + 180)
        let rootPoint = CGPoint(x: 180, y: height / 2)

        var nodes: [LayoutNode] = []
        var links: [LayoutLink] = []
        var positions: [UUID: CGPoint] = [root.id: rootPoint]
        var leafCursor: CGFloat = 90

        for child in root.children {
            layoutRightNode(
                child,
                parentID: root.id,
                depth: 1,
                leafCursor: &leafCursor,
                horizontalStep: horizontalStep,
                verticalStep: verticalStep,
                positions: &positions,
                links: &links
            )
        }

        collectLayoutNodes(root, positions: positions, nodes: &nodes)
        let contentSize = boundingSize(nodes: nodes, fallback: viewport)
        return MindMapLayoutResult(nodes: nodes, links: links, contentSize: contentSize)
    }

    @discardableResult
    private static func layoutRightNode(
        _ node: MindMapNode,
        parentID: UUID,
        depth: Int,
        leafCursor: inout CGFloat,
        horizontalStep: CGFloat,
        verticalStep: CGFloat,
        positions: inout [UUID: CGPoint],
        links: inout [LayoutLink]
    ) -> CGFloat {
        links.append(LayoutLink(source: parentID, target: node.id))

        if node.children.isEmpty {
            let y = leafCursor
            leafCursor += verticalStep
            positions[node.id] = CGPoint(x: 180 + CGFloat(depth) * horizontalStep, y: y)
            return y
        }

        var childYs: [CGFloat] = []
        for child in node.children {
            childYs.append(layoutRightNode(
                child,
                parentID: node.id,
                depth: depth + 1,
                leafCursor: &leafCursor,
                horizontalStep: horizontalStep,
                verticalStep: verticalStep,
                positions: &positions,
                links: &links
            ))
        }

        let y = childYs.reduce(0, +) / CGFloat(max(1, childYs.count))
        positions[node.id] = CGPoint(x: 180 + CGFloat(depth) * horizontalStep, y: y)
        return y
    }

    private static func collectLayoutNodes(
        _ node: MindMapNode,
        positions: [UUID: CGPoint],
        nodes: inout [LayoutNode]
    ) {
        let position = positions[node.id] ?? .zero
        nodes.append(LayoutNode(
            id: node.id,
            title: node.title,
            depth: node.depth,
            position: position,
            size: measuredSize(for: node),
            isRoot: node.depth == 0,
            sourceNode: node
        ))
        for child in node.children {
            collectLayoutNodes(child, positions: positions, nodes: &nodes)
        }
    }

    private static func resolveOverlaps(nodes: inout [LayoutNode], center: CGPoint) {
        guard nodes.count > 2 else { return }

        for _ in 0..<8 {
            var changed = false
            for leftIndex in nodes.indices {
                for rightIndex in nodes.indices where rightIndex > leftIndex {
                    guard nodes[leftIndex].id != nodes[rightIndex].id else { continue }
                    let left = nodes[leftIndex].rect.insetBy(dx: -14, dy: -12)
                    let right = nodes[rightIndex].rect.insetBy(dx: -14, dy: -12)
                    guard left.intersects(right) else { continue }

                    var leftNode = nodes[leftIndex]
                    var rightNode = nodes[rightIndex]
                    let vector = CGVector(
                        dx: rightNode.position.x - leftNode.position.x,
                        dy: rightNode.position.y - leftNode.position.y
                    )
                    let length = max(1, hypot(vector.dx, vector.dy))
                    let overlapX = min(left.maxX, right.maxX) - max(left.minX, right.minX)
                    let overlapY = min(left.maxY, right.maxY) - max(left.minY, right.minY)
                    let push = max(10, min(overlapX, overlapY) / 2 + 10)
                    let dx = vector.dx / length * push
                    let dy = vector.dy / length * push

                    if !leftNode.isRoot {
                        leftNode = leftNode.movedBy(dx: -dx, dy: -dy, center: center)
                        nodes[leftIndex] = leftNode
                    }
                    if !rightNode.isRoot {
                        rightNode = rightNode.movedBy(dx: dx, dy: dy, center: center)
                        nodes[rightIndex] = rightNode
                    }
                    changed = true
                }
            }
            if !changed { return }
        }
    }

    private static func leafWeight(_ node: MindMapNode) -> Int {
        if node.children.isEmpty { return 1 }
        return node.children.map(leafWeight).reduce(0, +)
    }

    private static func boundingSize(nodes: [LayoutNode], fallback: CGSize) -> CGSize {
        guard let first = nodes.first else { return fallback }
        let rect = nodes.dropFirst().reduce(first.rect) { $0.union($1.rect) }
        return CGSize(
            width: max(fallback.width, rect.maxX - min(0, rect.minX) + 220),
            height: max(fallback.height, rect.maxY - min(0, rect.minY) + 220)
        )
    }
}

private extension LayoutNode {
    func movedBy(dx: CGFloat, dy: CGFloat, center: CGPoint) -> LayoutNode {
        let away = CGVector(dx: position.x - center.x, dy: position.y - center.y)
        let length = max(1, hypot(away.dx, away.dy))
        let outwardBoost: CGFloat = 0.12
        let next = CGPoint(
            x: position.x + dx + away.dx / length * abs(dx) * outwardBoost,
            y: position.y + dy + away.dy / length * abs(dy) * outwardBoost
        )
        return LayoutNode(
            id: id,
            title: title,
            depth: depth,
            position: next,
            size: size,
            isRoot: isRoot,
            sourceNode: sourceNode
        )
    }
}
