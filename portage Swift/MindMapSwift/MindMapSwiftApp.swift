import SwiftUI

@main
struct MindMapSwiftApp: App {
    @StateObject private var model = MindMapAppModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}
