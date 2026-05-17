import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject private var model: MindMapAppModel
    @State private var showingLibrary = false
    @State private var showingCreateMap = false
    @State private var showingSource = false
    @State private var showingImporter = false
    @State private var nodeCreationRequest: NodeCreationRequest?
    @State private var renameRequest: RenameRequest?

    private let markdownType = UTType(filenameExtension: "md") ?? .plainText

    var body: some View {
        NavigationStack {
            MindMapCanvasView(
                nodeCreationRequest: $nodeCreationRequest,
                renameRequest: $renameRequest
            )
            .environmentObject(model)
            .navigationTitle(model.activeMapName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button {
                        showingLibrary = true
                    } label: {
                        Label("Cartes", systemImage: "folder")
                    }
                }

                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        model.saveCurrentMap()
                    } label: {
                        Label("Enregistrer", systemImage: "tray.and.arrow.down")
                    }

                    Menu {
                        Button {
                            showingImporter = true
                        } label: {
                            Label("Importer Markdown", systemImage: "square.and.arrow.down")
                        }

                        Button {
                            showingCreateMap = true
                        } label: {
                            Label("Créer une carte", systemImage: "plus.square")
                        }

                        Button {
                            showingSource = true
                        } label: {
                            Label("Modifier la source", systemImage: "doc.plaintext")
                        }

                        Button {
                            model.saveCurrentAsTemplate()
                        } label: {
                            Label("Enregistrer comme modèle", systemImage: "rectangle.on.rectangle")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showingLibrary) {
                LibraryView()
                    .environmentObject(model)
            }
            .sheet(isPresented: $showingCreateMap) {
                CreateMapView { title in
                    model.createMap(title: title)
                    showingCreateMap = false
                }
            }
            .sheet(isPresented: $showingSource) {
                SourceEditorView(source: model.markdown) { source in
                    model.updateFromSource(source)
                    showingSource = false
                }
            }
            .sheet(item: $nodeCreationRequest) { request in
                NodeCreationView(request: request) { title, nextAction in
                    commitNodeCreation(request: request, title: title, nextAction: nextAction)
                }
            }
            .sheet(item: $renameRequest) { request in
                RenameNodeView(request: request) { title in
                    model.renameNode(request.nodeID, title: title)
                    renameRequest = nil
                }
            }
            .fileImporter(
                isPresented: $showingImporter,
                allowedContentTypes: [markdownType, .plainText],
                allowsMultipleSelection: false
            ) { result in
                importMarkdown(result)
            }
            .alert("Action impossible", isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { model.errorMessage = nil }
            } message: {
                Text(model.errorMessage ?? "")
            }
        }
    }

    private func commitNodeCreation(
        request: NodeCreationRequest,
        title: String,
        nextAction: NodeInsertAction?
    ) {
        guard let added = model.addNode(
            action: request.action,
            referenceID: request.referenceID,
            title: title
        ) else {
            nodeCreationRequest = nil
            return
        }

        nodeCreationRequest = nil

        guard let nextAction else { return }
        DispatchQueue.main.async {
            nodeCreationRequest = NodeCreationRequest(action: nextAction, referenceID: added.id)
        }
    }

    private func importMarkdown(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let access = url.startAccessingSecurityScopedResource()
            defer {
                if access { url.stopAccessingSecurityScopedResource() }
            }

            let markdown = try String(contentsOf: url, encoding: .utf8)
            let name = url.deletingPathExtension().lastPathComponent
            model.loadMarkdown(markdown, name: name)
        } catch {
            model.errorMessage = "Le fichier Markdown n'a pas pu être importé."
        }
    }
}
