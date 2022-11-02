#![allow(dead_code)]

use petgraph::prelude::*;
use petgraph::stable_graph::StableUnGraph;
use std::collections::HashMap;

#[derive(Debug)]
pub struct Node {
    pub name: String,
    pub optimal_weighted_degree: f64,
}

impl Node {
    pub fn new(name: String) -> Node {
        Node {
            name,
            optimal_weighted_degree: 0.0,
        }
    }
}

// Add clone trait to Node
impl Clone for Node {
    fn clone(&self) -> Self {
        Node {
            name: self.name.clone(),
            optimal_weighted_degree: self.optimal_weighted_degree,
        }
    }
}

// Add hash to Node so that we can use it as a key in a HashMap
impl std::hash::Hash for Node {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.name.hash(state);
    }
}

// Add equality operator to Node
impl std::cmp::Eq for Node {}

// Add partial equality operator to Node
impl std::cmp::PartialEq for Node {
    fn eq(&self, other: &Self) -> bool {
        self.name == other.name
    }
}

#[derive(Debug)]
pub struct Edge {
    pub u: petgraph::graph::NodeIndex,
    pub v: petgraph::graph::NodeIndex,
    pub weight: f64,
}

// Add hash operator to Edge
impl std::hash::Hash for Edge {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.u.hash(state);
        self.v.hash(state);
    }
}

impl Edge {
    pub fn new(u: petgraph::graph::NodeIndex, v: petgraph::graph::NodeIndex, weight: f64) -> Edge {
        Edge { u, v, weight }
    }
}

// Add clone trait to Edge
impl Clone for Edge {
    fn clone(&self) -> Self {
        Edge {
            u: self.u.clone(),
            v: self.v.clone(),
            weight: self.weight,
        }
    }
}

// Add eq operator to Edge
impl std::cmp::Eq for Edge {}

// Add equality operator to Edge
impl PartialEq for Edge {
    fn eq(&self, other: &Self) -> bool {
        self.u == other.u && self.v == other.v
    }
}

pub struct Graph {
    pub g: StableGraph<Node, Edge, Undirected>,
    pub node_idx_map: HashMap<String, petgraph::graph::NodeIndex>,
    pub edge_idx_map: HashMap<
        (petgraph::graph::NodeIndex, petgraph::graph::NodeIndex),
        Vec<petgraph::graph::EdgeIndex>,
    >,
}

impl Graph {
    /// Creates a new graph and returns it.
    pub fn new() -> Graph {
        Graph {
            g: StableUnGraph::<Node, Edge>::default(), // StableGraph::new(),
            node_idx_map: HashMap::new(),
            edge_idx_map: HashMap::new(),
        }
    }

    /// Add a node to the graph. Returns the node index.
    ///
    /// # Arguments
    ///
    /// * `name` - String identifier of the node.
    pub fn add_node(&mut self, name: String) -> petgraph::graph::NodeIndex {
        let node = Node::new(name.clone());
        let node_idx = self.g.add_node(node.clone());
        self.node_idx_map.insert(node.name.clone(), node_idx);
        node_idx
    }

    /// Removes node from the graph (and all edges connected to it). Does not return anything.
    ///
    /// # Arguments
    ///
    /// * `node_idx` - Node index of the node to be removed.
    pub fn remove_node(&mut self, node: petgraph::graph::NodeIndex) {
        let node_u = self.g.node_weight(node).unwrap().clone();

        for neighbor_node in self.get_neighbors_idx(node_u.name.clone()) {
            let node_v = self.g.node_weight(neighbor_node.clone()).unwrap();
            self.remove_edge(node_u.name.clone(), node_v.name.clone(), None, Some(false));
        }

        self.g.remove_node(node.clone());
    }

    /// Updates the weight of the node. Does not return anything.
    ///
    /// # Arguments
    ///
    /// * `idx` - Index of the node we want to update, represented as NodeIndex
    /// * `new_weight` - New weight of the node
    pub fn change_node_opt_weight(&mut self, idx: petgraph::graph::NodeIndex, new_weight: f64) {
        let mut node = self.g.node_weight_mut(idx).unwrap();
        node.optimal_weighted_degree = new_weight * 2.0;
    }

    /// Adds the edge to the graph and insert the edge index into the edge_idx_map
    /// (where the key is the tuple of the node indices and the value is the list
    /// of edges). We maintain a list because we allow parallel edges to exist.
    /// Does not return anything.
    ///
    /// # Arguments
    ///
    /// * `u` - String identifier of the first node
    /// * `v` - String identifier of the second node
    /// * `weight` - Float weight of the edge
    pub fn add_edge(&mut self, u: String, v: String, weight: f64) {
        if !self.node_idx_map.contains_key(&u) {
            let error_message = format!("Node {} does not exist", u);
            return print_error_and_return(&error_message);
        }
        if !self.node_idx_map.contains_key(&v) {
            let error_message = format!("Node {} does not exist", v);
            return print_error_and_return(&error_message);
        }

        let u_idx = self.node_idx_map.get(&u).unwrap().clone();
        let v_idx = self.node_idx_map.get(&v).unwrap().clone();

        let edge = Edge::new(u_idx.clone(), v_idx.clone(), weight);

        let edge_idx = self.g.add_edge(u_idx.clone(), v_idx.clone(), edge);

        // Insert new edge into edge_idx_map which maps (u, v) to a list of edge indices
        let edge_idx_list = self
            .edge_idx_map
            .entry((u_idx.clone(), v_idx.clone()))
            .or_insert(Vec::new());

        edge_idx_list.push(edge_idx);

        // Insert new edge into edge_idx_map which maps (v, u) to a list of edge indices
        let edge_idx_list = self
            .edge_idx_map
            .entry((v_idx.clone(), u_idx.clone()))
            .or_insert(Vec::new());

        edge_idx_list.push(edge_idx);

        self.change_node_opt_weight(u_idx.clone(), weight);
        self.change_node_opt_weight(v_idx.clone(), weight);
    }

    /// Updates the weight of the edge. Does not return anything.
    ///
    /// # Arguments
    ///
    /// * `u` - String identifier of the first node
    /// * `v` - String identifier of the second node
    /// * `weight` - Float weight of the edge
    /// * `parallel_edge_idx` - Optional usize index of the parallel edge we want to update.
    pub fn update_edge(
        &mut self,
        u: String,
        v: String,
        weight: f64,
        parallel_edge_idx: Option<usize>,
    ) {
        if !self.node_idx_map.contains_key(&u) {
            let error_message = format!("Node {} does not exist", u);
            return print_error_and_return(&error_message);
        }
        if !self.node_idx_map.contains_key(&v) {
            let error_message = format!("Node {} does not exist", v);
            return print_error_and_return(&error_message);
        }

        let u_idx = self.node_idx_map.get(&u).unwrap();
        let v_idx = self.node_idx_map.get(&v).unwrap();

        // Check if edge does not exist
        if !self.g.contains_edge(u_idx.clone(), v_idx.clone()) {
            self.add_edge(u.clone(), v.clone(), weight);
            return;
        }

        let edge_idx = self
            .edge_idx_map
            .get(&(u_idx.clone(), v_idx.clone()))
            .unwrap();
        let old_weight = self
            .g
            .edge_weight(edge_idx.clone()[parallel_edge_idx.unwrap_or(0)])
            .unwrap()
            .weight;

        let edge_1 = Edge::new(u_idx.clone(), v_idx.clone(), weight);

        let edge_idx_1 = self.g.update_edge(u_idx.clone(), v_idx.clone(), edge_1);
        //let edge_idx_2 = self.g.update_edge(v_idx.clone(), u_idx.clone(), edge_2);

        let u_idx_clone = u_idx.clone();
        let v_idx_clone = v_idx.clone();

        // Update edge_idx_map to reflect the new edge index
        let edge_idx_list = self
            .edge_idx_map
            .entry((u_idx_clone, v_idx_clone))
            .or_insert(Vec::new());

        edge_idx_list[parallel_edge_idx.unwrap_or(0)] = edge_idx_1;

        // Update edge_idx_map to reflect the new edge index
        let edge_idx_list = self
            .edge_idx_map
            .entry((v_idx_clone, u_idx_clone))
            .or_insert(Vec::new());

        edge_idx_list[parallel_edge_idx.unwrap_or(0)] = edge_idx_1;

        self.change_node_opt_weight(u_idx_clone, weight - old_weight);
        self.change_node_opt_weight(v_idx_clone, weight - old_weight);
    }

    pub fn get_edge_weight(
        &self,
        u: String,
        v: String,
        parallel_edge_idx: Option<usize>,
        get_all_parallel: Option<bool>,
    ) -> f64 {
        if !self.node_idx_map.contains_key(&u) {
            let error_message = format!("Node {} does not exist", u);
            println!("{}", error_message);
            return 0.0;
        }
        if !self.node_idx_map.contains_key(&v) {
            let error_message = format!("Node {} does not exist", v);
            println!("{}", error_message);
            return 0.0;
        }

        let u_idx = self.node_idx_map.get(&u).unwrap();
        let v_idx = self.node_idx_map.get(&v).unwrap();

        // Check if edge does not exist
        if !self.g.contains_edge(u_idx.clone(), v_idx.clone()) {
            return 0.0;
        }

        let edge_idx_list = self
            .edge_idx_map
            .get(&(u_idx.clone(), v_idx.clone()))
            .unwrap();

        let mut weight = 0.0;
        if get_all_parallel.unwrap_or(false) {
            weight = self
                .g
                .edge_weight(edge_idx_list.clone()[parallel_edge_idx.unwrap_or(0)])
                .unwrap()
                .weight;
        } else {
            for edge_idx in edge_idx_list {
                weight += self.g.edge_weight(edge_idx.clone()).unwrap().weight;
            }
        }

        weight
    }

    /// Removes an edge from the graph. Does not return anything.
    ///
    /// # Arguments
    ///
    /// * `u` - String identifier of the first node
    /// * `v` - String identifier of the second node
    /// * `parallel_edge_idx` - Optional usize index of the parallel edge we want to remove.
    /// * `remove_all_parallel` - Optional bool flag to remove all parallel edges.
    pub fn remove_edge(
        &mut self,
        u: String,
        v: String,
        parallel_edge_idx: Option<usize>,
        remove_all_parallel: Option<bool>,
    ) {
        if !self.node_idx_map.contains_key(&u) {
            let error_message = format!("Node {} does not exist", u);
            return print_error_and_return(&error_message);
        }
        if !self.node_idx_map.contains_key(&v) {
            let error_message = format!("Node {} does not exist", v);
            return print_error_and_return(&error_message);
        }

        let u_idx = self.node_idx_map.get(&u).unwrap().clone();
        let v_idx = self.node_idx_map.get(&v).unwrap().clone();

        // Check if edge does not exist
        if !self.g.contains_edge(u_idx.clone(), v_idx.clone()) {
            println!("Edge: ({}, {}) does not exist", u, v);
            return print_error_and_return("Edge does not exist");
        }

        let edge_idx_list = self
            .edge_idx_map
            .get(&(u_idx.clone(), v_idx.clone()))
            .unwrap()
            .clone();

        // If remove_all_parallel is false, then remove the single edge in the list whose
        // index is parallel_edge_idx (default 0).
        if !remove_all_parallel.unwrap_or(false) {
            let weight = self
                .g
                .edge_weight(edge_idx_list.clone()[parallel_edge_idx.unwrap_or(0)])
                .unwrap()
                .weight;

            self.g
                .remove_edge(edge_idx_list.clone()[parallel_edge_idx.unwrap_or(0)]);

            let edge_idx_list_mut = self
                .edge_idx_map
                .entry((v_idx.clone(), u_idx.clone()))
                .or_insert(Vec::new());

            edge_idx_list_mut.swap_remove(parallel_edge_idx.unwrap_or(0));

            let edge_idx_list_mut = self
                .edge_idx_map
                .entry((u_idx.clone(), v_idx.clone()))
                .or_insert(Vec::new());

            edge_idx_list_mut.swap_remove(parallel_edge_idx.unwrap_or(0));

            self.change_node_opt_weight(u_idx.clone(), -weight);
            self.change_node_opt_weight(v_idx.clone(), -weight);
        } else {
            // If remove_all_parallel is true, then remove all edges in the list.
            for edge_idx in edge_idx_list.clone() {
                let weight = self.g.edge_weight(edge_idx.clone()).unwrap().weight;

                self.g.remove_edge(edge_idx.clone());

                self.change_node_opt_weight(u_idx.clone(), -weight);
                self.change_node_opt_weight(v_idx.clone(), -weight);
            }

            self.edge_idx_map.remove(&(u_idx.clone(), v_idx.clone()));
            self.edge_idx_map.remove(&(v_idx.clone(), u_idx.clone()));
        }
    }

    /// Returns the number of nodes in the graph.
    pub fn get_order(&self) -> usize {
        self.g.node_count()
    }

    /// Returns the number of edges in the graph.
    pub fn get_size(&self) -> usize {
        self.g.edge_count()
    }

    /// Clones the graph and returns it.
    pub fn clone(&self) -> Graph {
        Graph {
            g: self.g.clone(),
            node_idx_map: self.node_idx_map.clone(),
            edge_idx_map: self.edge_idx_map.clone(),
        }
    }

    /// Returns all the nodes in the graph.
    pub fn get_nodes(&self) -> Vec<Node> {
        let mut nodes = Vec::new();
        for node in self.g.node_weights() {
            nodes.push(node.clone());
        }
        nodes
    }

    /// Returns the node associated with the given node index.
    ///
    /// # Arguments
    ///
    /// * `node_idx` - NodeIndex of the node we want to get.
    pub fn get_node(&self, idx: petgraph::graph::NodeIndex) -> Node {
        self.g.node_weight(idx).unwrap().clone()
    }

    /// Returns the node index associated with the given node identifier.
    ///
    /// # Arguments
    ///
    /// * `node_id` - String identifier of the node we want to get.
    pub fn get_node_idx(&self, node: String) -> petgraph::graph::NodeIndex {
        self.node_idx_map.get(&node).unwrap().clone()
    }

    /// Returns a list of all the edges in the graph.
    pub fn get_edges(&self) -> Vec<Edge> {
        let mut edges = Vec::new();
        for edge in self.g.edge_weights() {
            edges.push(edge.clone());
        }
        edges
    }

    /// Returns the nodes connected to the given node.
    ///
    /// # Arguments
    ///
    /// * `node` - String identifier of the node we want to get the neighbors of.
    pub fn get_neighbors(&self, node: String) -> Vec<Node> {
        let node_weight = self.node_idx_map.get(&node).unwrap();
        let mut neighbors = Vec::new();
        for neighbor in self.g.neighbors_undirected(node_weight.clone()) {
            neighbors.push(self.g.node_weight(neighbor).unwrap().clone());
        }

        neighbors
    }

    /// Returns the indices of the nodes connected to the given node.
    ///
    /// # Arguments
    ///
    /// * `node` - String identifier of the node we want to get the neighbors of.
    pub fn get_neighbors_idx(&self, node: String) -> Vec<petgraph::graph::NodeIndex> {
        let node_weight = self.node_idx_map.get(&node).unwrap();
        let mut neighbors = Vec::new();
        for neighbor in self.g.neighbors_undirected(node_weight.clone()) {
            neighbors.push(neighbor.clone());
        }

        neighbors
    }

    /// Returns the number of edges connected to the given node.
    ///
    /// # Arguments
    ///
    /// * `node` - String identifier of the node we want to get the degree of.
    pub fn degree_of(&self, node: String) -> usize {
        if !self.node_idx_map.contains_key(&node) {
            let error_message = format!("Node {} does not exist", node);
            println!("{}", error_message);
            return 0;
        }

        let node_idx = self.node_idx_map.get(&node).unwrap();
        self.g.neighbors_undirected(node_idx.clone()).count()
    }

    /// Returns a list of cumulative edge weights.
    pub fn get_cumulative_edge_weights(&self) -> Vec<f64> {
        let mut cumulative_edge_weights = Vec::new();
        let mut total_weight = 0.0;
        for edge in self.g.edge_weights() {
            total_weight += edge.weight * 2.0;
            cumulative_edge_weights.push(total_weight);
        }
        cumulative_edge_weights
    }
}

// Function to print given error and return
fn print_error_and_return(error: &str) {
    println!("{}", error);
    return;
}

// Create a unit test for the Graph struct
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_graph() {
        // Create a graph
        let mut G = Graph::new();

        // Create a few nodes and edges and add to graph
        let u: String = "u".to_string();
        let v: String = "v".to_string();
        let w: String = "w".to_string();

        let u_idx = G.add_node(u.clone());
        let v_idx = G.add_node(v.clone());
        let w_idx = G.add_node(w.clone());

        assert_eq!(G.get_order(), 3);

        G.add_edge(u.clone(), v.clone(), 1 as f64);
        G.add_edge(u.clone(), w.clone(), 1 as f64);
        G.add_edge(v.clone(), w.clone(), 35 as f64);

        assert_eq!(G.get_size(), 3);

        G.update_edge(u.clone(), v.clone(), 11 as f64, None);
        G.remove_edge(u.clone(), w.clone(), None, Some(true));

        assert_eq!(G.get_size(), 2);
    }
}
