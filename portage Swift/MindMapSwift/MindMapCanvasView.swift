import SwiftUI

struct MindMapCanvasView: View {
    @EnvironmentObject private var model: MindMapAppModel
    @Binding var nodeCreationRequest: NodeCreationRequest?
    @Binding var renameRequest: RenameRequest?

    @State private var scale: CGFloat = 1
    @State private var baseScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var baseOffset: CGSize = .zero
    @State private var didInitialFit = false

    var body: some View {
        GeometryReader { proxy in
            let viewport = proxy.size
            let layout = MindMapLayoutEngine.layout(
                root: model.visibleRoot,
                mode: model.layoutMode,
                viewport: CGSize(width: max(900, viewport.width * 1.6), height: max(700, viewport.height * 1.5))
            )

            ZStack {
                backgroundGrid

                Canvas { context, _ in
                    drawLinks(layout, context: &context)
                }
                .allowsHitTesting(false)

                ForEach(layout.nodes) { node in
                    MindMapNodeView(
                        node: node,
                        selected: model.selectedNodeID == node.id,
                        searchHit: activeSearchID == node.id
                    )
                    .position(transform(node.position))
                    .onTapGesture {
                        model.selectAndExpand(node.id)
                        center(on: node.id, layout: layout, viewport: viewport)
                    }
                    .contextMenu {
                        Button {
                            nodeCreationRequest = NodeCreationRequest(action: .child, referenceID: node.id)
                        } label: {
                            Label("Ajouter un enfant", systemImage: "plus")
                        }

                        Button {
                            nodeCreationRequest = NodeCreationRequest(action: .sibling, referenceID: node.id)
                        } label: {
                            Label("Ajouter un frère", systemImage: "plus.rectangle.on.rectangle")
                        }
                        .disabled(node.isRoot)

                        Button {
                            renameRequest = RenameRequest(nodeID: node.id, currentTitle: node.title)
                        } label: {
                            Label("Renommer", systemImage: "pencil")
                        }

                        Button(role: .destructive) {
                            model.selectedNodeID = node.id
                            model.deleteSelectedNode()
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                        .disabled(node.isRoot)
                    }
                }

                VStack {
                    canvasToolbar(layout: layout, viewport: viewport)
                    Spacer()
                    selectedNodeBar
                }
                .padding(12)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.horizontal, 10)
            .padding(.bottom, 10)
            .gesture(panGesture)
            .simultaneousGesture(zoomGesture)
            .onAppear {
                guard !didInitialFit else { return }
                didInitialFit = true
                fit(layout: layout, viewport: viewport)
            }
            .onChange(of: model.layoutMode) { _, _ in
                fit(layout: layout, viewport: viewport)
            }
        }
        .background(Color.appBackground.ignoresSafeArea())
    }

    private func canvasToolbar(layout: MindMapLayoutResult, viewport: CGSize) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                TextField("Rechercher", text: $model.searchText)
                    .textFieldStyle(.roundedBorder)
                    .submitLabel(.search)
                    .onSubmit {
                        if let id = model.resetSearchFocus() {
                            center(on: id, layout: layout, viewport: viewport)
                        }
                    }
                    .onChange(of: model.searchText) { _, _ in
                        if let id = model.resetSearchFocus() {
                            center(on: id, layout: layout, viewport: viewport)
                        }
                    }

                Button {
                    if let id = model.focusSearchResult(offset: -1) {
                        center(on: id, layout: layout, viewport: viewport)
                    }
                } label: {
                    Image(systemName: "chevron.left")
                }
                .disabled(model.searchMatches.isEmpty)

                Text(searchCounter)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 38)

                Button {
                    if let id = model.focusSearchResult(offset: 1) {
                        center(on: id, layout: layout, viewport: viewport)
                    }
                } label: {
                    Image(systemName: "chevron.right")
                }
                .disabled(model.searchMatches.isEmpty)
            }

            HStack(spacing: 8) {
                Button {
                    setScale(scale / 1.18, viewport: viewport)
                } label: {
                    Image(systemName: "minus.magnifyingglass")
                }

                Text("\(Int(scale * 100)) %")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 54)

                Button {
                    setScale(scale * 1.18, viewport: viewport)
                } label: {
                    Image(systemName: "plus.magnifyingglass")
                }

                Button("Ajuster") {
                    fit(layout: layout, viewport: viewport)
                }

                Button(model.layoutMode.label) {
                    model.layoutMode = model.layoutMode == .radial ? .right : .radial
                }
                .buttonStyle(.borderedProminent)

                Button("Recentrer") {
                    center(on: model.root.id, layout: layout, viewport: viewport)
                }
            }
            .buttonStyle(.bordered)
            .font(.caption)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var selectedNodeBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.selectedNode?.title ?? "Aucun nœud sélectionné")
                .font(.headline)
                .lineLimit(2)

            HStack {
                Button {
                    if let id = model.selectedNodeID {
                        nodeCreationRequest = NodeCreationRequest(action: .child, referenceID: id)
                    }
                } label: {
                    Label("Enfant", systemImage: "plus")
                }

                Button {
                    if let node = model.selectedNode, node.depth > 0 {
                        nodeCreationRequest = NodeCreationRequest(action: .sibling, referenceID: node.id)
                    }
                } label: {
                    Label("Frère", systemImage: "plus.rectangle.on.rectangle")
                }
                .disabled(model.selectedNode?.depth == 0)

                Button {
                    if let node = model.selectedNode {
                        renameRequest = RenameRequest(nodeID: node.id, currentTitle: node.title)
                    }
                } label: {
                    Label("Renommer", systemImage: "pencil")
                }

                Button(role: .destructive) {
                    model.deleteSelectedNode()
                } label: {
                    Label("Supprimer", systemImage: "trash")
                }
                .disabled(model.selectedNode?.depth == 0)
            }
            .font(.caption)
            .buttonStyle(.bordered)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var searchCounter: String {
        let total = model.searchMatches.count
        guard total > 0, model.activeSearchIndex >= 0 else { return "0/0" }
        return "\(model.activeSearchIndex + 1)/\(total)"
    }

    private var activeSearchID: UUID? {
        let matches = model.searchMatches
        guard model.activeSearchIndex >= 0, model.activeSearchIndex < matches.count else { return nil }
        return matches[model.activeSearchIndex]
    }

    private var backgroundGrid: some View {
        Canvas { context, size in
            let spacing: CGFloat = 36
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += spacing
            }
            var y: CGFloat = 0
            while y <= size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += spacing
            }
            context.stroke(path, with: .color(Color.white.opacity(0.055)), lineWidth: 1)
        }
        .background(Color.canvasBackground)
    }

    private func drawLinks(_ layout: MindMapLayoutResult, context: inout GraphicsContext) {
        let byID = layout.nodeByID
        for link in layout.links {
            guard let source = byID[link.source], let target = byID[link.target] else { continue }
            let start = transform(source.position)
            let end = transform(target.position)
            let midX = (start.x + end.x) / 2
            var path = Path()
            path.move(to: start)
            path.addCurve(
                to: end,
                control1: CGPoint(x: midX, y: start.y),
                control2: CGPoint(x: midX, y: end.y)
            )
            context.stroke(path, with: .color(Color.link.opacity(0.74)), lineWidth: max(1.2, scale * 1.8))
        }
    }

    private var panGesture: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { value in
                offset = CGSize(
                    width: baseOffset.width + value.translation.width,
                    height: baseOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                baseOffset = offset
            }
    }

    private var zoomGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                scale = clamp(baseScale * value)
            }
            .onEnded { _ in
                baseScale = scale
            }
    }

    private func transform(_ point: CGPoint) -> CGPoint {
        CGPoint(x: point.x * scale + offset.width, y: point.y * scale + offset.height)
    }

    private func fit(layout: MindMapLayoutResult, viewport: CGSize) {
        guard let rect = boundingRect(layout.nodes) else { return }
        let padding: CGFloat = 68
        let fittedScale = clamp(min(
            (viewport.width - padding) / max(1, rect.width),
            (viewport.height - padding) / max(1, rect.height)
        ))
        scale = fittedScale
        baseScale = fittedScale
        let center = CGPoint(x: rect.midX, y: rect.midY)
        offset = CGSize(
            width: viewport.width / 2 - center.x * fittedScale,
            height: viewport.height / 2 - center.y * fittedScale
        )
        baseOffset = offset
    }

    private func center(on id: UUID, layout: MindMapLayoutResult, viewport: CGSize) {
        guard let node = layout.nodeByID[id] else { return }
        offset = CGSize(
            width: viewport.width / 2 - node.position.x * scale,
            height: viewport.height / 2 - node.position.y * scale
        )
        baseOffset = offset
    }

    private func setScale(_ next: CGFloat, viewport: CGSize) {
        let oldScale = scale
        let newScale = clamp(next)
        let center = CGPoint(x: viewport.width / 2, y: viewport.height / 2)
        let contentCenter = CGPoint(
            x: (center.x - offset.width) / max(oldScale, 0.01),
            y: (center.y - offset.height) / max(oldScale, 0.01)
        )
        scale = newScale
        baseScale = newScale
        offset = CGSize(
            width: center.x - contentCenter.x * newScale,
            height: center.y - contentCenter.y * newScale
        )
        baseOffset = offset
    }

    private func clamp(_ value: CGFloat) -> CGFloat {
        min(4.0, max(0.12, value))
    }

    private func boundingRect(_ nodes: [LayoutNode]) -> CGRect? {
        guard let first = nodes.first else { return nil }
        return nodes.dropFirst().reduce(first.rect) { $0.union($1.rect) }
    }
}
