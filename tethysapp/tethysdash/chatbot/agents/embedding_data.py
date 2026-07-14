INTENT_ADD = "add_plugin"
INTENT_DOCS = "answer_docs_question"
INTENT_LIST = "list_plugins"
INTENT_OOS = "out_of_scope"

INTENTS: dict[str, list[str]] = {
    INTENT_ADD: [
        "add the plugin named X with argument value 123",
        "add the my_data_source plugin for id 12 and code 34",
        "add the my_data_source plugin for station 12345 with args arg_1 x, arg_y 3, arg_z 7",
        "put the my_data_source plugin on the dashboard for station 3222",
        "add a tile using the rainfall plugin for gauge 55",
        "add a visualization to my dashboard",
        "add the same plugin again for a different value",
        # real intake-driver name shapes (snake_case domain tokens) so
        # actual plugin references match, not just generic placeholders
        "add the usgs_water_services plugin for site 09380000",
        "add the cw3e_surface_meterology plugin",
        "add the hydroserver_plot plugin for datastream 5",
        "add the cnrfc_daily_briefing tile",
        "add the cimss_integrated_microwave_animations plugin",
    ],
    INTENT_DOCS: [
        "how do I create a variable input?",
        "what is a variable input?",
        "what types of variable input are supported?",
        "how do I create a map with a wms layer?",
        "how do I configure a geojson layer?",
        "how do I configure a vector or raster layer?",
        "how do I configure a pmtiles or cog layer?",
        "can I share a dashboard with other users?",
        "where do I set the dashboard permissions?",
        "how do I install and set up the app?",
        "how do I get started?",
        "explain how plugins work",
        # broader coverage of real doc topics (dashboard editing, map
        # layer config, plugin development) so held-out how-to questions
        # on these topics match instead of falling to the OOS fallback
        "how do dashboard tabs work?",
        "how do I undo a change on my dashboard?",
        "how does the dashboard item context menu work?",
        "how do I show a legend for a map layer?",
        "how do I style map features based on conditions?",
        "how do I show a popup when a feature is clicked?",
        "how do I pick a different base map?",
        "how do I use a variable input to filter a chart?",
        "how do I make a brand new dashboard?",
        "how do I develop a custom plugin?",
        "how do I save and revert dashboard changes?",
        "how do I configure a visualization's settings?",
    ],
    INTENT_LIST: [
        "what plugins are available?",
        "what custom plugins are available?",
        "list the available visualizations",
        "what plugins can I add to my dashboard?",
        "show me the plugin catalog",
        "which plugins are installed?",
    ],
    INTENT_OOS: [
        "how are you?",
        "what's the weather today?",
        "tell me a joke",
        "who won the game last night?",
        "thanks, that's all",
        "what time is it?",
    ],
}