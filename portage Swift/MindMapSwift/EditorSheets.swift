import SwiftUI

struct CreateMapView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    let onCreate: (String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Titre") {
                    TextField("Nœud central", text: $title)
                        .submitLabel(.done)
                        .onSubmit(submit)
                }
            }
            .navigationTitle("Créer une carte")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer", action: submit)
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func submit() {
        onCreate(title)
    }
}

struct SourceEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var source: String
    let onApply: (String) -> Void

    init(source: String, onApply: @escaping (String) -> Void) {
        self._source = State(initialValue: source)
        self.onApply = onApply
    }

    var body: some View {
        NavigationStack {
            TextEditor(text: $source)
                .font(.system(.body, design: .monospaced))
                .padding()
                .navigationTitle("Source Markdown")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Mettre à jour") { onApply(source) }
                    }
                }
        }
    }
}

struct NodeCreationView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    let request: NodeCreationRequest
    let onCommit: (String, NodeInsertAction?) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Nouveau nœud \(request.action.label)") {
                    TextField("Nom du nœud", text: $title, axis: .vertical)
                        .lineLimit(1...4)
                        .submitLabel(.done)
                        .onSubmit { commit(next: nil) }
                }

                Section {
                    Button("OK") { commit(next: nil) }
                    Button("OK + enfant") { commit(next: .child) }
                    Button("OK + frère") { commit(next: .sibling) }
                }
                .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .navigationTitle("Ajouter un nœud")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
        }
    }

    private func commit(next: NodeInsertAction?) {
        onCommit(title, next)
        dismiss()
    }
}

struct RenameNodeView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    let request: RenameRequest
    let onCommit: (String) -> Void

    init(request: RenameRequest, onCommit: @escaping (String) -> Void) {
        self.request = request
        self.onCommit = onCommit
        self._title = State(initialValue: request.currentTitle)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Nom") {
                    TextField("Nom du nœud", text: $title, axis: .vertical)
                        .lineLimit(1...4)
                        .submitLabel(.done)
                        .onSubmit(submit)
                }
            }
            .navigationTitle("Renommer")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK", action: submit)
                        .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func submit() {
        onCommit(title)
        dismiss()
    }
}
